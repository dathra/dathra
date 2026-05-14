import { css } from "@dathra/components";

const pageStyles = css`
  :host {
    display: block;
  }

  main {
    display: grid;
    gap: 20px;
  }

  .meta-chip {
    display: inline-flex;
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(33, 71, 60, 0.1);
    color: #21473c;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .count,
  .counter-value {
    font-weight: 700;
    color: #0f5b3a;
  }

  .counter-row,
  .probe-grid {
    display: grid;
    gap: 12px;
  }
`;

export { pageStyles };
