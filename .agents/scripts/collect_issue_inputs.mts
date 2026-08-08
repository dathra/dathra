#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  fchmodSync,
  fsyncSync,
  globSync,
  linkSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

type JsonObject = { [key: string]: unknown };
type Source = { [key: string]: unknown };
type Fence = { marker: string; length: number };
type Section = {
  heading: string;
  level: number;
  line: number;
  lines: Array<[number, string]>;
  ancestorHeadings: string[];
  content: string;
};
type Candidate = {
  text: string;
  source: Source;
};
type ProposalField = {
  label: string;
  required: boolean;
};
type ApiClient = {
  api(endpoint: string, options?: { paginated?: boolean }): unknown;
};
type SourceStatusKind = "collected" | "absent" | "incomplete";
type SourceStatus = {
  status: SourceStatusKind;
  missingSources: string[];
};
type SourceStatuses = {
  issue: IssueCompleteness;
  comments: SourceStatus;
  nativeRelationships: SourceStatus;
  references: SourceStatus;
  proposal: SourceStatus;
};
type OptionalApiResult = {
  value: unknown;
  error: string | null;
};
type ProposalDiscoveryResult = {
  proposal: JsonObject | null;
  status: SourceStatus;
};
type IssueCompleteness = SourceStatus & {
  issueType: string | null;
  requiredFields: string[];
  missingRequiredFields: string[];
  duplicateRequiredSections: string[];
};
type IssueRequirements = Record<string, Candidate[]>;

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;
const LIST_ITEM_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/;
const FENCE_PATTERN = /^ {0,3}(?<marker>`{3,}|~{3,})(?<rest>.*)$/;
const BACKTICK_RUN_PATTERN = /`+/g;
const URL_REFERENCE_PATTERN =
  /https:\/\/github\.com\/(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)\/(?:issues|pull)\/(?<number>\d+)/g;
const QUALIFIED_REFERENCE_PATTERN =
  /(?<![A-Za-z0-9_.-])(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)#(?<number>\d+)\b/g;
const LOCAL_REFERENCE_PATTERN = /(?<![A-Za-z0-9_.-])#(?<number>\d+)\b/g;
const GH_MAX_ATTEMPTS = 3;
const GH_RETRY_DELAYS_MS = [100, 250];
const PROPOSAL_FIELDS: Record<string, ProposalField> = {
  decisionToMake: { label: "Decision to make", required: true },
  contextAndEvidence: { label: "Context and evidence", required: true },
  optionsConsidered: { label: "Options considered", required: true },
  decisionCriteria: { label: "Decision criteria", required: true },
  acceptanceCriteria: { label: "Acceptance criteria", required: true },
  dependencies: { label: "Dependencies", required: false },
  nonGoals: { label: "Non-goals", required: true },
};
const TASK_FIELDS: Record<string, ProposalField> = {
  parentIssue: { label: "Parent issue", required: true },
  outcome: { label: "Outcome", required: true },
  preconditions: { label: "Preconditions", required: true },
  work: { label: "Work", required: true },
  verification: { label: "Verification", required: true },
  acceptanceCriteria: { label: "Acceptance criteria", required: true },
  dependencies: { label: "Dependencies", required: false },
  nonGoals: { label: "Non-goals", required: true },
};

class CollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionError";
  }
}

class GhClient implements ApiClient {
  readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  currentRepository(): string {
    const result = requireObject(parseJson(this.run("repo", "view", "--json", "nameWithOwner")));
    return requireString(result.nameWithOwner, "GitHub repository name");
  }

  api(endpoint: string, options: { paginated?: boolean } = {}): unknown {
    const argumentsList = [
      "api",
      "-H",
      "Accept: application/vnd.github+json",
      "-H",
      "X-GitHub-Api-Version: 2022-11-28",
    ];
    if (options.paginated) {
      argumentsList.push("--paginate", "--slurp");
    }
    argumentsList.push(endpoint);
    const result = parseJson(this.run(...argumentsList));
    return options.paginated ? flattenPages(result) : result;
  }

  private run(...argumentsList: string[]): string {
    for (let attempt = 1; attempt <= GH_MAX_ATTEMPTS; attempt += 1) {
      const completed = spawnSync("gh", argumentsList, {
        cwd: this.cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 30_000,
      });
      if (completed.status === 0 && !completed.error) {
        return completed.stdout;
      }
      const errorCode =
        completed.error && isNodeError(completed.error) ? completed.error.code : undefined;
      const detail =
        completed.error?.message ||
        completed.stderr.trim() ||
        completed.stdout.trim() ||
        "unknown error";
      if (errorCode === "ENOENT") {
        throw new CollectionError("GitHub CLI `gh` is not installed");
      }
      const message = `gh ${argumentsList.join(" ")} failed: ${detail}`;
      if (attempt < GH_MAX_ATTEMPTS && isRetryableGhFailure(errorCode, detail)) {
        waitForRetry(GH_RETRY_DELAYS_MS[attempt - 1] ?? 250);
        continue;
      }
      throw new CollectionError(message);
    }
    throw new CollectionError(`gh ${argumentsList.join(" ")} failed: unknown error`);
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

function isRetryableGhFailure(code: string | undefined, message: string): boolean {
  if (
    [
      "EAGAIN",
      "ECONNREFUSED",
      "ECONNRESET",
      "ECONNABORTED",
      "ENETRESET",
      "ENETUNREACH",
      "EHOSTUNREACH",
      "ETIMEDOUT",
    ].includes(code ?? "")
  ) {
    return true;
  }
  return /\b(?:429|500|502|503|504)\b|rate limit|temporar|timed out|timeout|connection reset/i.test(
    message,
  );
}

function waitForRetry(delayMs: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new CollectionError(
      `GitHub returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown): JsonObject {
  if (!isObject(value)) {
    throw new CollectionError("GitHub response is not an object");
  }
  return value;
}

function requireIssueRecord(
  value: unknown,
  expectedNumber?: number,
  expectedRepository?: string,
): JsonObject {
  if (!isIssueRecord(value, expectedNumber, expectedRepository)) {
    throw new CollectionError("GitHub response is not a valid Issue record");
  }
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new CollectionError(`${name} is not a string`);
  }
  return value;
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function createSourceStatus(status: SourceStatusKind = "collected"): SourceStatus {
  return { status, missingSources: [] };
}

function createIssueCompleteness(): IssueCompleteness {
  return {
    ...createSourceStatus(),
    issueType: null,
    requiredFields: [],
    missingRequiredFields: [],
    duplicateRequiredSections: [],
  };
}

function markSourceIncomplete(sourceStatus: SourceStatus, source: string): void {
  sourceStatus.status = "incomplete";
  if (!sourceStatus.missingSources.includes(source)) {
    sourceStatus.missingSources.push(source);
  }
}

function markSourceAbsent(sourceStatus: SourceStatus): void {
  sourceStatus.status = "absent";
  sourceStatus.missingSources = [];
}

function createSourceStatuses(): SourceStatuses {
  return {
    issue: createIssueCompleteness(),
    comments: createSourceStatus(),
    nativeRelationships: createSourceStatus(),
    references: createSourceStatus(),
    proposal: createSourceStatus(),
  };
}

function readObjectArray(
  value: unknown,
  source: string,
  warnings: string[],
): { records: JsonObject[]; valid: boolean } {
  if (!Array.isArray(value)) {
    warnings.push(`${source} response is not an array`);
    return { records: [], valid: false };
  }
  const records = objectArray(value);
  if (records.length !== value.length) {
    warnings.push(`${source} response contains non-object records`);
    return { records, valid: false };
  }
  return { records, valid: true };
}

function readIssueArray(
  value: unknown,
  source: string,
  warnings: string[],
  expectedRepository?: string,
): { records: JsonObject[]; valid: boolean } {
  const result = readObjectArray(value, source, warnings);
  const records = result.records.filter((record) =>
    isRelatedIssueRecord(record, undefined, expectedRepository),
  );
  if (!result.valid || records.length !== result.records.length) {
    warnings.push(`${source} response contains invalid Issue records`);
    return { records, valid: false };
  }
  return { records, valid: true };
}

function readCommentArray(
  value: unknown,
  source: string,
  warnings: string[],
): { records: JsonObject[]; valid: boolean } {
  const result = readObjectArray(value, source, warnings);
  const records = result.records.filter(isCommentRecord);
  if (!result.valid || records.length !== result.records.length) {
    warnings.push(`${source} response contains invalid comment records`);
    return { records, valid: false };
  }
  return { records, valid: true };
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isIssueRecord(
  value: unknown,
  expectedNumber?: number,
  expectedRepository?: string,
): value is JsonObject {
  if (!isObject(value)) {
    return false;
  }
  const number = nonNegativeInteger(value.number);
  const repositoryMatches =
    expectedRepository === undefined
      ? hasRepositoryIdentity(value)
      : issueRepositoryMatches(value, expectedRepository);
  return (
    number !== null &&
    number > 0 &&
    (expectedNumber === undefined || number === expectedNumber) &&
    repositoryMatches
  );
}

function isIssueLabelArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((label) => isObject(label) && typeof label.name === "string")
  );
}

function isRelatedIssueRecord(
  value: unknown,
  expectedNumber?: number,
  expectedRepository?: string,
): value is JsonObject {
  if (
    !isIssueRecord(value, expectedNumber, expectedRepository) ||
    typeof value.title !== "string" ||
    !isIssueLabelArray(value.labels)
  ) {
    return false;
  }
  return !Object.hasOwn(value, "pull_request") || isObject(value.pull_request);
}

function isCommentRecord(value: unknown): value is JsonObject {
  if (!isObject(value)) {
    return false;
  }
  const user = isObject(value.user) ? value.user : null;
  const id = nonNegativeInteger(value.id);
  return (
    id !== null &&
    id > 0 &&
    typeof value.body === "string" &&
    user !== null &&
    typeof user.login === "string"
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function splitLines(value: string): string[] {
  if (!value) {
    return [];
  }
  const lines: string[] = [];
  let current = "";
  let endedWithSeparator = false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 13 && value.charCodeAt(index + 1) === 10) {
      index += 1;
    } else if (![10, 11, 12, 13, 28, 29, 30, 133, 8232, 8233].includes(code)) {
      current += value[index];
      endedWithSeparator = false;
      continue;
    }
    lines.push(current);
    current = "";
    endedWithSeparator = true;
  }
  if (!endedWithSeparator) {
    lines.push(current);
  }
  return lines;
}

function flattenPages(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new CollectionError("paginated GitHub response is not an array");
  }
  if (value.length === 0) {
    return [];
  }
  if (!value.every(Array.isArray)) {
    throw new CollectionError("paginated GitHub response contains a non-array page");
  }
  return value.flat();
}

function updateFence(line: string, fence: Fence | null): [Fence | null, boolean] {
  const match = FENCE_PATTERN.exec(line);
  const marker = match?.groups?.marker;
  if (!marker) {
    return [fence, false];
  }
  if (fence === null) {
    return [{ marker: marker[0] ?? "", length: marker.length }, true];
  }
  if (
    marker[0] === fence.marker &&
    marker.length >= fence.length &&
    !(match.groups?.rest ?? "").trim()
  ) {
    return [null, true];
  }
  return [fence, false];
}

function parseMarkdownSections(body: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let headingStack: Section[] = [];
  let fence: Fence | null = null;

  splitLines(body).forEach((line, index) => {
    const lineNumber = index + 1;
    const previousFence = fence;
    const [nextFence, transitioned] = updateFence(line, fence);
    fence = nextFence;
    if (transitioned || previousFence !== null) {
      current?.lines.push([lineNumber, line]);
      return;
    }

    const heading = fence === null ? HEADING_PATTERN.exec(line) : null;
    if (heading) {
      const level = heading[1]?.length ?? 0;
      headingStack = headingStack.filter((item) => item.level < level);
      current = {
        heading: (heading[2] ?? "").trim(),
        level,
        line: lineNumber,
        lines: [],
        ancestorHeadings: headingStack.map((item) => item.heading),
        content: "",
      };
      sections.push(current);
      headingStack.push(current);
      return;
    }
    current?.lines.push([lineNumber, line]);
  });

  for (const section of sections) {
    section.content = section.lines
      .map(([, line]) => line)
      .join("\n")
      .trimEnd();
    section.lines = [];
  }
  return sections;
}

function sectionCandidates(
  sections: Section[],
  headings: Set<string>,
  issueNumber: number,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const section of sections) {
    const headingPath = [...section.ancestorHeadings, section.heading];
    const recognizedIndexes = headingPath.flatMap((heading, index) =>
      headings.has(heading) ? [index] : [],
    );
    if (recognizedIndexes.length === 0) {
      continue;
    }
    candidates.push(
      ...contentCandidates(section.content, {
        issueNumber,
        heading: headingPath.slice(recognizedIndexes[0]).join(" > "),
        startLine: section.line + 1,
      }),
    );
  }
  return candidates;
}

function contentCandidates(
  content: string,
  options: { issueNumber: number; heading: string; startLine: number },
): Candidate[] {
  const candidates: Candidate[] = [];
  const currentText: string[] = [];
  let currentLine = options.startLine;
  let fence: Fence | null = null;

  const finish = (): void => {
    if (currentText.length === 0) {
      return;
    }
    candidates.push({
      text: currentText
        .map((part) => part.trim())
        .join(" ")
        .trim(),
      source: {
        kind: "issue-body",
        issue: options.issueNumber,
        heading: options.heading,
        line: currentLine,
      },
    });
    currentText.length = 0;
  };

  splitLines(content).forEach((line, offset) => {
    const lineNumber = options.startLine + offset;
    const previousFence = fence;
    const [nextFence, transitioned] = updateFence(line, fence);
    fence = nextFence;
    if (transitioned) {
      finish();
      return;
    }
    if (previousFence !== null || fence !== null) {
      return;
    }
    if ((line.startsWith("    ") || line.startsWith("\t")) && currentText.length === 0) {
      finish();
      return;
    }
    const item = LIST_ITEM_PATTERN.exec(line);
    if (item) {
      finish();
      currentLine = lineNumber;
      currentText.push(item[1] ?? "");
      return;
    }
    if (!line.trim()) {
      finish();
      return;
    }
    if (currentText.length === 0) {
      currentLine = lineNumber;
    }
    currentText.push(line);
  });
  finish();
  return candidates;
}

function issueRepository(
  issue: JsonObject,
  defaultRepository: string | null = null,
): string | null {
  const repositoryUrl = issue.repository_url;
  if (typeof repositoryUrl === "string") {
    const repository = /\/repos\/(?<repository>[^/]+\/[^/]+)$/.exec(repositoryUrl)?.groups
      ?.repository;
    if (repository) {
      return repository;
    }
  }
  return defaultRepository;
}

function hasRepositoryIdentity(issue: JsonObject): boolean {
  return typeof issue.repository_url === "string" && issueRepository(issue) !== null;
}

function issueRepositoryMatches(issue: JsonObject, expectedRepository: string): boolean {
  return hasRepositoryIdentity(issue) && issueRepository(issue) === expectedRepository;
}

function issueFieldValue(issue: JsonObject, fieldName: string): string | null {
  const values = issue.issue_field_values ?? issue.field_values;
  for (const field of objectArray(values)) {
    if (field.issue_field_name !== fieldName && field.field !== fieldName) {
      continue;
    }
    if (isObject(field.single_select_option)) {
      return stringValue(field.single_select_option.name);
    }
    return field.value === null || field.value === undefined ? null : String(field.value);
  }
  return null;
}

function issueTypeName(issue: JsonObject): string | null {
  const issueType = isObject(issue.type) ? issue.type : null;
  return issueType ? stringValue(issueType.name) : null;
}

function issueNumberFromUrl(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /\/issues\/(\d+)(?:$|[?#])/.exec(value);
  const number = match?.[1] ? Number(match[1]) : null;
  return number !== null && Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizeIssue(issue: JsonObject, defaultRepository: string | null = null): JsonObject {
  return {
    number: numberValue(issue.number),
    repository: issueRepository(issue, defaultRepository),
    title: stringValue(issue.title),
    state: stringValue(issue.state),
    stateReason: stringValue(issue.state_reason),
    type: issueTypeName(issue),
    proposalProgress: issueFieldValue(issue, "Proposal Progress"),
    url: stringValue(issue.html_url),
    body: typeof issue.body === "string" ? issue.body : "",
    labels: objectArray(issue.labels).map((label) => stringValue(label.name)),
    createdAt: stringValue(issue.created_at),
    updatedAt: stringValue(issue.updated_at),
  };
}

function normalizeComment(comment: JsonObject, issueNumber: number): JsonObject {
  const user = isObject(comment.user) ? comment.user : {};
  const commentId = numberValue(comment.id);
  return {
    id: commentId,
    author: stringValue(user.login),
    body: typeof comment.body === "string" ? comment.body : "",
    url: stringValue(comment.html_url),
    createdAt: stringValue(comment.created_at),
    updatedAt: stringValue(comment.updated_at),
    source: { kind: "issue-comment", issue: issueNumber, commentId },
  };
}

function normalizeNativeRelationshipIssue(
  issue: JsonObject,
  defaultRepository: string,
  relationship: string,
  endpoint: string,
): JsonObject {
  const normalized = normalizeIssue(issue, defaultRepository);
  normalized.referencedFrom = [
    {
      kind: "native-relationship",
      relationship,
      endpoint,
    },
  ];
  return normalized;
}

function relationKey(issue: JsonObject): string {
  return `${String(issue.repository)}#${String(issue.number)}`;
}

function timelineRelations(
  events: JsonObject[],
  defaultRepository: string,
  endpoint = "timeline",
): [JsonObject[], JsonObject[], boolean] {
  const relatedIssues = new Map<string, JsonObject>();
  const relatedPullRequests = new Map<string, JsonObject>();
  let valid = true;
  for (const event of events) {
    const source = isObject(event.source) ? event.source : null;
    if (!source || !Object.hasOwn(source, "issue")) {
      continue;
    }
    if (!isRelatedIssueRecord(source.issue)) {
      valid = false;
      continue;
    }
    const issue = source.issue;
    const normalized = normalizeIssue(issue, defaultRepository);
    const provenance: JsonObject = {
      kind: "timeline-cross-reference",
      relationship: "timeline",
      endpoint,
    };
    if (typeof event.id === "string" || typeof event.id === "number") {
      provenance.eventId = event.id;
    }
    const timestamp = stringValue(event.created_at) ?? stringValue(event.updated_at);
    if (timestamp !== null) {
      provenance.timestamp = timestamp;
    }
    normalized.referencedFrom = [provenance];
    const records = issue.pull_request ? relatedPullRequests : relatedIssues;
    mergeRelatedRecord(records, normalized);
  }
  return [[...relatedIssues.values()], [...relatedPullRequests.values()], valid];
}

function extractIssueReferences(
  text: string,
  options: { defaultRepository: string; source: Source },
): JsonObject[] {
  const references = new Map<string, JsonObject>();
  const occupiedSpans: Array<[number, number]> = [];
  const visibleText = markdownWithoutCode(text);

  const add = (repository: string, number: number, span: [number, number]): void => {
    references.set(`${repository}#${number}`, {
      repository,
      number,
      source: options.source,
    });
    occupiedSpans.push(span);
  };

  for (const pattern of [URL_REFERENCE_PATTERN, QUALIFIED_REFERENCE_PATTERN]) {
    for (const match of visibleText.matchAll(pattern)) {
      const owner = match.groups?.owner;
      const repo = match.groups?.repo;
      const number = Number(match.groups?.number);
      if (owner && repo && Number.isInteger(number) && match.index !== undefined) {
        add(`${owner}/${repo}`, number, [match.index, match.index + match[0].length]);
      }
    }
  }
  for (const match of visibleText.matchAll(LOCAL_REFERENCE_PATTERN)) {
    const number = Number(match.groups?.number);
    const start = match.index;
    if (
      start === undefined ||
      occupiedSpans.some(([occupiedStart, end]) => occupiedStart <= start && start < end)
    ) {
      continue;
    }
    if (Number.isInteger(number)) {
      add(options.defaultRepository, number, [start, start + match[0].length]);
    }
  }
  return [...references.values()];
}

function markdownWithoutCode(text: string): string {
  const visibleLines: string[] = [];
  let fence: Fence | null = null;
  for (const line of splitLines(text)) {
    const previousFence = fence;
    const [nextFence, transitioned] = updateFence(line, fence);
    fence = nextFence;
    if (transitioned || previousFence !== null || fence !== null) {
      visibleLines.push("");
      continue;
    }
    if (line.startsWith("    ") || line.startsWith("\t")) {
      visibleLines.push("");
      continue;
    }
    visibleLines.push(line);
  }
  return removeInlineCodeByBlocks(visibleLines);
}

function removeInlineCodeByBlocks(lines: string[]): string {
  const output: string[] = [];
  const block: string[] = [];
  const finish = (): void => {
    if (block.length === 0) {
      return;
    }
    output.push(...splitLines(removeInlineCodeSpans(block.join("\n"))));
    block.length = 0;
  };

  for (const line of lines) {
    if (!line.trim()) {
      finish();
      output.push("");
      continue;
    }
    if (HEADING_PATTERN.test(line)) {
      finish();
      output.push(removeInlineCodeSpans(line));
      continue;
    }
    if (LIST_ITEM_PATTERN.test(line)) {
      finish();
    }
    block.push(line);
  }
  finish();
  return output.join("\n");
}

function removeInlineCodeSpans(text: string): string {
  const output = text.split("");
  const runs = [...text.matchAll(BACKTICK_RUN_PATTERN)];
  let index = 0;
  while (index < runs.length) {
    const opener = runs[index];
    if (!opener || opener.index === undefined) {
      index += 1;
      continue;
    }
    let closerIndex = index + 1;
    while (closerIndex < runs.length) {
      const closer = runs[closerIndex];
      if (closer && closer.index !== undefined && closer[0].length === opener[0].length) {
        for (
          let position = opener.index;
          position < closer.index + closer[0].length;
          position += 1
        ) {
          if (output[position] !== "\n") {
            output[position] = " ";
          }
        }
        index = closerIndex;
        break;
      }
      closerIndex += 1;
    }
    index += 1;
  }
  return output.join("");
}

function mergeRelatedRecord(records: Map<string, JsonObject>, record: JsonObject): void {
  const key = relationKey(record);
  const existing = records.get(key);
  if (!existing) {
    records.set(key, record);
    return;
  }
  const existingSources = Array.isArray(existing.referencedFrom) ? existing.referencedFrom : [];
  existing.referencedFrom = existingSources;
  const sources = Array.isArray(record.referencedFrom) ? record.referencedFrom : [];
  for (const source of sources) {
    if (
      !existingSources.some((candidate) => JSON.stringify(candidate) === JSON.stringify(source))
    ) {
      existingSources.push(source);
    }
  }
}

function findProposalWithStatus(
  root: string,
  issueNumber: number,
  warnings: string[],
): ProposalDiscoveryResult {
  let matches: string[];
  try {
    matches = globSync(`SPEC/proposals/**/${issueNumber}.typ`, { cwd: root }).sort();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Proposal discovery failed: ${message}`);
    return {
      proposal: null,
      status: { status: "incomplete", missingSources: ["proposal-file"] },
    };
  }
  if (matches.length === 0) {
    warnings.push(`No Proposal file named ${issueNumber}.typ was found`);
    const status = createSourceStatus();
    markSourceAbsent(status);
    return { proposal: null, status };
  }
  const status = createSourceStatus();
  if (matches.length > 1) {
    warnings.push(
      `Multiple Proposal files named ${issueNumber}.typ were found: ${matches.join(", ")}`,
    );
    markSourceIncomplete(status, "proposal-file");
    return { proposal: null, status };
  }
  const path = matches[0];
  if (!path) {
    warnings.push(`Proposal discovery returned no path for ${issueNumber}.typ`);
    markSourceIncomplete(status, "proposal-file");
    return { proposal: null, status };
  }
  try {
    return {
      proposal: {
        path,
        content: readFileSync(resolve(root, path), "utf8"),
        source: { kind: "proposal-file", path },
      },
      status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Proposal file ${path} could not be read: ${message}`);
    markSourceIncomplete(status, "proposal-file");
    return { proposal: null, status };
  }
}

function findProposal(root: string, issueNumber: number, warnings: string[]): JsonObject | null {
  return findProposalWithStatus(root, issueNumber, warnings).proposal;
}

function extractTemplateRequirements(
  sections: Section[],
  issueNumber: number,
): Record<string, Candidate[]> {
  return Object.fromEntries(
    Object.entries(PROPOSAL_FIELDS).map(([key, field]) => [
      key,
      sectionCandidates(sections, new Set([field.label]), issueNumber),
    ]),
  );
}

function emptyProposalRequirements(): Record<string, Candidate[]> {
  return Object.fromEntries(Object.keys(PROPOSAL_FIELDS).map((key) => [key, []]));
}

function fieldsForIssueType(issueType: string | null): Record<string, ProposalField> {
  if (issueType === "Proposal") {
    return PROPOSAL_FIELDS;
  }
  if (issueType === "Task") {
    return TASK_FIELDS;
  }
  return {};
}

function extractIssueRequirements(
  sections: Section[],
  issueNumber: number,
  issueType: string | null,
): IssueRequirements {
  if (issueType !== "Task") {
    return {};
  }
  const fields = fieldsForIssueType(issueType);
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      sectionCandidates(sections, new Set([field.label]), issueNumber),
    ]),
  );
}

function warnAboutHeadingVariants(
  sections: Section[],
  warnings: string[],
  fields: Record<string, ProposalField> = PROPOSAL_FIELDS,
  fieldScope = "Proposal",
): void {
  for (const section of sections) {
    for (const field of Object.values(fields)) {
      if (
        section.heading !== field.label &&
        section.heading.replaceAll(/\s+/g, " ").toLowerCase() === field.label.toLowerCase()
      ) {
        warnings.push(
          `Unsupported ${fieldScope} field heading ${JSON.stringify(section.heading)}; expected ${JSON.stringify(field.label)}`,
        );
      }
    }
  }
}

function assessIssueRequirements(
  sections: Section[],
  issueType: string | null,
  requirements: IssueRequirements,
): {
  requiredFields: string[];
  missingRequiredFields: string[];
  duplicateRequiredSections: string[];
} {
  const fields = fieldsForIssueType(issueType);
  const requiredFields = Object.values(fields)
    .filter((field) => field.required)
    .map((field) => field.label);
  const missingRequiredFields = Object.entries(fields)
    .filter(([key, field]) => field.required && (requirements[key]?.length ?? 0) === 0)
    .map(([, field]) => field.label);
  const duplicateRequiredSections = requiredFields.filter(
    (label) => sections.filter((section) => section.heading === label).length > 1,
  );
  return { requiredFields, missingRequiredFields, duplicateRequiredSections };
}

function optionalApi(
  client: ApiClient,
  endpoint: string,
  warnings: string[],
  options: { paginated?: boolean; defaultValue: unknown },
): OptionalApiResult {
  try {
    return { value: client.api(endpoint, { paginated: options.paginated }), error: null };
  } catch (error) {
    if (!(error instanceof CollectionError)) {
      throw error;
    }
    warnings.push(error.message);
    return { value: options.defaultValue, error: error.message };
  }
}

function collectInputs(
  client: ApiClient,
  options: { repository: string; issueNumber: number; root: string },
): JsonObject {
  const warnings: string[] = [];
  const completeness = createSourceStatuses();
  const [owner, name, ...extra] = options.repository.split("/");
  if (!owner || !name || extra.length > 0) {
    throw new CollectionError("repository must use the OWNER/REPO form");
  }

  const base = `repos/${owner}/${name}/issues/${options.issueNumber}`;
  const issue = requireIssueRecord(client.api(base), options.issueNumber, options.repository);
  if (issue.pull_request) {
    throw new CollectionError(`#${options.issueNumber} is a Pull Request, not an Issue`);
  }

  const commentsResponse = optionalApi(client, `${base}/comments?per_page=100`, warnings, {
    paginated: true,
    defaultValue: [],
  });
  const commentsResult = readCommentArray(commentsResponse.value, "comments", warnings);
  const comments = commentsResult.records;
  if (commentsResponse.error || !commentsResult.valid) {
    markSourceIncomplete(completeness.comments, "comments");
  }

  let children: JsonObject[] = [];
  const childSummary = isObject(issue.sub_issues_summary) ? issue.sub_issues_summary : null;
  const childTotal = childSummary ? nonNegativeInteger(childSummary.total) : null;
  // A valid zero summary is sufficient; querying an empty endpoint adds failure surface.
  if (childTotal === null) {
    warnings.push("Issue response did not include a valid sub_issues_summary.total");
    markSourceIncomplete(completeness.nativeRelationships, "children");
  } else if (childTotal > 0) {
    const childrenEndpoint = `${base}/sub_issues?per_page=100`;
    const childrenResponse = optionalApi(client, childrenEndpoint, warnings, {
      paginated: true,
      defaultValue: [],
    });
    const childrenResult = readIssueArray(
      childrenResponse.value,
      "children",
      warnings,
      options.repository,
    );
    children = childrenResult.records;
    if (childrenResponse.error || !childrenResult.valid) {
      markSourceIncomplete(completeness.nativeRelationships, "children");
    }
    if (children.length !== childTotal) {
      warnings.push(`Children count ${children.length} did not match summary total ${childTotal}`);
      markSourceIncomplete(completeness.nativeRelationships, "children");
    }
  }

  let parentIssue: JsonObject | null = null;
  if (issue.parent_issue_url) {
    const parentNumber = issueNumberFromUrl(issue.parent_issue_url);
    const parentEndpoint = `${base}/parent`;
    if (parentNumber === null) {
      warnings.push("Parent relationship URL did not contain an Issue number");
      markSourceIncomplete(completeness.nativeRelationships, "parent");
    } else {
      const parentResponse = optionalApi(client, parentEndpoint, warnings, { defaultValue: null });
      if (parentResponse.error) {
        markSourceIncomplete(completeness.nativeRelationships, "parent");
      } else if (!isRelatedIssueRecord(parentResponse.value, parentNumber, options.repository)) {
        warnings.push(`Parent response did not contain Issue #${parentNumber}`);
        markSourceIncomplete(completeness.nativeRelationships, "parent");
      } else {
        parentIssue = parentResponse.value;
      }
    }
  }

  let blockedBy: JsonObject[] = [];
  let blocking: JsonObject[] = [];
  const dependencySummary = isObject(issue.issue_dependencies_summary)
    ? issue.issue_dependencies_summary
    : null;
  const blockedByTotal = dependencySummary
    ? nonNegativeInteger(dependencySummary.total_blocked_by)
    : null;
  const blockingTotal = dependencySummary
    ? nonNegativeInteger(dependencySummary.total_blocking)
    : null;
  if (blockedByTotal === null || blockingTotal === null) {
    warnings.push("Issue response did not include valid issue_dependencies_summary totals");
    markSourceIncomplete(completeness.nativeRelationships, "blockedBy");
    markSourceIncomplete(completeness.nativeRelationships, "blocking");
  } else {
    // Valid zero dependency totals are complete without extra empty-list requests.
    if (blockedByTotal > 0) {
      const blockedByEndpoint = `${base}/dependencies/blocked_by?per_page=100`;
      const blockedByResponse = optionalApi(client, blockedByEndpoint, warnings, {
        paginated: true,
        defaultValue: [],
      });
      const blockedByResult = readIssueArray(
        blockedByResponse.value,
        "blockedBy",
        warnings,
        options.repository,
      );
      blockedBy = blockedByResult.records;
      if (blockedByResponse.error || !blockedByResult.valid) {
        markSourceIncomplete(completeness.nativeRelationships, "blockedBy");
      }
      if (blockedBy.length !== blockedByTotal) {
        warnings.push(
          `blockedBy count ${blockedBy.length} did not match summary total ${blockedByTotal}`,
        );
        markSourceIncomplete(completeness.nativeRelationships, "blockedBy");
      }
    }
    if (blockingTotal > 0) {
      const blockingEndpoint = `${base}/dependencies/blocking?per_page=100`;
      const blockingResponse = optionalApi(client, blockingEndpoint, warnings, {
        paginated: true,
        defaultValue: [],
      });
      const blockingResult = readIssueArray(
        blockingResponse.value,
        "blocking",
        warnings,
        options.repository,
      );
      blocking = blockingResult.records;
      if (blockingResponse.error || !blockingResult.valid) {
        markSourceIncomplete(completeness.nativeRelationships, "blocking");
      }
      if (blocking.length !== blockingTotal) {
        warnings.push(
          `blocking count ${blocking.length} did not match summary total ${blockingTotal}`,
        );
        markSourceIncomplete(completeness.nativeRelationships, "blocking");
      }
    }
  }

  const timelineEndpoint = `${base}/timeline?per_page=100`;
  const timelineResponse = optionalApi(client, timelineEndpoint, warnings, {
    paginated: true,
    defaultValue: [],
  });
  const timelineResult = readObjectArray(timelineResponse.value, "timeline", warnings);
  const timeline = timelineResult.records;
  if (timelineResponse.error || !timelineResult.valid) {
    markSourceIncomplete(completeness.references, "timeline");
  }
  if (completeness.comments.status === "incomplete") {
    markSourceIncomplete(completeness.references, "comments");
  }
  const [timelineIssues, timelinePullRequests, timelineValid] = timelineRelations(
    timeline,
    options.repository,
    timelineEndpoint,
  );
  if (!timelineValid) {
    warnings.push("timeline contains invalid source.issue records");
    markSourceIncomplete(completeness.references, "timeline");
  }
  const relatedIssues = new Map(timelineIssues.map((item) => [relationKey(item), item]));
  const relatedPullRequests = new Map(
    timelinePullRequests.map((item) => [relationKey(item), item]),
  );
  const excludedRelationKeys = new Set([`${options.repository}#${options.issueNumber}`]);
  if (parentIssue) {
    excludedRelationKeys.add(relationKey(normalizeIssue(parentIssue, options.repository)));
  }
  for (const key of excludedRelationKeys) {
    relatedIssues.delete(key);
  }

  const issueBody = typeof issue.body === "string" ? issue.body : "";
  const directReferences = extractIssueReferences(issueBody, {
    defaultRepository: options.repository,
    source: { kind: "issue-body", issue: options.issueNumber },
  });
  for (const comment of comments) {
    directReferences.push(
      ...extractIssueReferences(typeof comment.body === "string" ? comment.body : "", {
        defaultRepository: options.repository,
        source: {
          kind: "issue-comment",
          issue: options.issueNumber,
          commentId: numberValue(comment.id),
        },
      }),
    );
  }

  const referencesByKey = new Map<string, JsonObject>();
  for (const reference of directReferences) {
    const repository = stringValue(reference.repository);
    const number = numberValue(reference.number);
    if (!repository || number === null) {
      continue;
    }
    const key = `${repository}#${number}`;
    if (excludedRelationKeys.has(key)) {
      continue;
    }
    let entry = referencesByKey.get(key);
    if (!entry) {
      entry = { repository, number, sources: [] };
      referencesByKey.set(key, entry);
    }
    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    entry.sources = sources;
    if (!sources.some((source) => JSON.stringify(source) === JSON.stringify(reference.source))) {
      sources.push(reference.source);
    }
  }

  for (const reference of referencesByKey.values()) {
    const repository = requireString(reference.repository, "referenced repository");
    const number = numberValue(reference.number);
    if (number === null) {
      continue;
    }
    const referencedIssue = optionalApi(client, `repos/${repository}/issues/${number}`, warnings, {
      defaultValue: null,
    });
    const referenceKey = `${repository}#${number}`;
    if (referencedIssue.error) {
      markSourceIncomplete(completeness.references, referenceKey);
      continue;
    }
    if (!isRelatedIssueRecord(referencedIssue.value, number, repository)) {
      warnings.push(`Referenced Issue ${referenceKey} returned no matching Issue record`);
      markSourceIncomplete(completeness.references, referenceKey);
      continue;
    }
    const normalized = normalizeIssue(referencedIssue.value, repository);
    normalized.referencedFrom = reference.sources;
    mergeRelatedRecord(
      referencedIssue.value.pull_request ? relatedPullRequests : relatedIssues,
      normalized,
    );
  }

  const sections = parseMarkdownSections(issueBody);
  const issueType = issueTypeName(issue);
  const requirements =
    issueType === "Proposal"
      ? extractTemplateRequirements(sections, options.issueNumber)
      : emptyProposalRequirements();
  const issueRequirements = extractIssueRequirements(sections, options.issueNumber, issueType);
  const applicableFields = fieldsForIssueType(issueType);
  const diagnosticFields = issueType === "Task" ? TASK_FIELDS : PROPOSAL_FIELDS;
  const diagnosticRequirements = issueType === "Task" ? issueRequirements : requirements;
  const requirementCompleteness = assessIssueRequirements(
    sections,
    issueType,
    diagnosticRequirements,
  );
  completeness.issue.issueType = issueType;
  completeness.issue.requiredFields = requirementCompleteness.requiredFields;
  completeness.issue.missingRequiredFields = requirementCompleteness.missingRequiredFields;
  completeness.issue.duplicateRequiredSections = requirementCompleteness.duplicateRequiredSections;
  if (issueType === null) {
    warnings.push("Issue response did not include an Issue type");
    markSourceIncomplete(completeness.issue, "issue-type");
  } else if (Object.keys(applicableFields).length === 0) {
    warnings.push(`Unsupported Issue type ${JSON.stringify(issueType)}`);
    markSourceIncomplete(completeness.issue, `issue-type:${issueType}`);
  }
  for (const field of requirementCompleteness.missingRequiredFields) {
    markSourceIncomplete(completeness.issue, `issue-body:required-field:${field}`);
  }
  for (const field of requirementCompleteness.duplicateRequiredSections) {
    markSourceIncomplete(completeness.issue, `issue-body:duplicate-required-section:${field}`);
  }
  warnAboutHeadingVariants(
    sections,
    warnings,
    diagnosticFields,
    issueType === "Task" ? "Task" : "Proposal",
  );
  for (const [key, field] of Object.entries(diagnosticFields)) {
    if (
      field.required &&
      diagnosticRequirements[key]?.length === 0 &&
      Object.keys(applicableFields).length > 0
    ) {
      warnings.push(`No ${field.label} section was recognized in the Issue body`);
    }
    const matches = sections.filter((section) => section.heading === field.label);
    if (matches.length > 1) {
      warnings.push(
        `Multiple ${field.label} headings were recognized: ${matches.map((item) => item.heading).join(", ")}`,
      );
    }
  }

  const proposalDiscovery = findProposalWithStatus(options.root, options.issueNumber, warnings);
  completeness.proposal = proposalDiscovery.status;

  return {
    collectedAt: new Date().toISOString(),
    repository: options.repository,
    issue: normalizeIssue(issue, options.repository),
    requirements,
    issueRequirements,
    sections: sections.map(({ heading, level, line, content, ancestorHeadings }) => ({
      heading,
      level,
      line,
      content,
      ancestorHeadings,
    })),
    comments: comments.map((comment) => normalizeComment(comment, options.issueNumber)),
    relationships: {
      parent: parentIssue
        ? normalizeNativeRelationshipIssue(
            parentIssue,
            options.repository,
            "parent",
            `${base}/parent`,
          )
        : null,
      children: children.map((child) =>
        normalizeNativeRelationshipIssue(
          child,
          options.repository,
          "children",
          `${base}/sub_issues?per_page=100`,
        ),
      ),
      blockedBy: blockedBy.map((item) =>
        normalizeNativeRelationshipIssue(
          item,
          options.repository,
          "blockedBy",
          `${base}/dependencies/blocked_by?per_page=100`,
        ),
      ),
      blocking: blocking.map((item) =>
        normalizeNativeRelationshipIssue(
          item,
          options.repository,
          "blocking",
          `${base}/dependencies/blocking?per_page=100`,
        ),
      ),
      relatedIssues: [...relatedIssues.values()],
      relatedPullRequests: [...relatedPullRequests.values()],
    },
    completeness,
    proposal: proposalDiscovery.proposal,
    warnings,
  };
}

function parseArguments(): {
  issueNumber: number;
  repository: string | null;
  root: string;
  compact: boolean;
  output: string;
} {
  let parsed: {
    values: {
      repo?: string;
      root?: string;
      compact?: boolean;
      output?: string;
    };
    positionals: string[];
  };
  try {
    parsed = parseArgs({
      allowPositionals: true,
      strict: true,
      options: {
        repo: { type: "string" },
        root: { type: "string", default: process.cwd() },
        compact: { type: "boolean", default: false },
        output: { type: "string" },
      },
    });
  } catch (error) {
    throw new CollectionError(error instanceof Error ? error.message : String(error));
  }
  if (parsed.positionals.length !== 1 || !/^\d+$/.test(parsed.positionals[0] ?? "")) {
    throw new CollectionError(
      "usage: collect_issue_inputs.mts <issue-number> [--repo OWNER/REPO] [--root PATH] [--compact] --output PATH",
    );
  }
  const issueNumber = Number(parsed.positionals[0]);
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    throw new CollectionError("issue number must be a positive integer");
  }
  if (!parsed.values.output) {
    throw new CollectionError(
      "--output is required because the collected JSON contains Issue source text",
    );
  }
  return {
    issueNumber,
    repository: parsed.values.repo ?? null,
    root: resolve(parsed.values.root ?? process.cwd()),
    compact: parsed.values.compact ?? false,
    output: resolve(parsed.values.output),
  };
}

function writeOutput(path: string, content: string): void {
  const parent = dirname(path);
  const name = basename(path);
  let temporaryPath = "";
  let descriptor: number | null = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    temporaryPath = resolve(parent, `.${name}.${randomUUID()}`);
    try {
      descriptor = openSync(temporaryPath, "wx", 0o600);
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  }
  if (descriptor === null) {
    throw new Error("could not allocate a temporary output file");
  }
  try {
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, `${content}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    linkSync(temporaryPath, path);
  } finally {
    if (descriptor !== null) {
      closeSync(descriptor);
    }
    unlinkIfExists(temporaryPath);
  }
}

function unlinkIfExists(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!isObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

function main(): number {
  try {
    const argumentsList = parseArguments();
    const client = new GhClient(argumentsList.root);
    const repository = argumentsList.repository ?? client.currentRepository();
    const result = collectInputs(client, {
      repository,
      issueNumber: argumentsList.issueNumber,
      root: argumentsList.root,
    });
    const serialized = JSON.stringify(
      sortJson(result),
      null,
      argumentsList.compact ? undefined : 2,
    );
    writeOutput(argumentsList.output, serialized);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = main();
}

export {
  CollectionError,
  GhClient,
  collectInputs,
  extractIssueReferences,
  extractIssueRequirements,
  extractTemplateRequirements,
  findProposal,
  flattenPages,
  isRetryableGhFailure,
  normalizeIssue,
  parseMarkdownSections,
  timelineRelations,
  writeOutput,
};
