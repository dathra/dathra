import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const MarkerTextPanel = defineComponent(
  "e2e-marker-text-panel",
  () => {
    const label = signal("alpha");

    return (
      <article>
        <p data-testid="marker-text">Current label: {label.value}</p>
        <button
          type="button"
          data-testid="marker-update-name"
          onClick={() => {
            label.set("beta");
          }}
        >
          Update text
        </button>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

const MarkerInsertPanel = defineComponent(
  "e2e-marker-insert-panel",
  () => {
    const showNote = signal(false);

    return (
      <article>
        {showNote.value ? (
          <p data-testid="marker-note">Inserted note is visible.</p>
        ) : (
          ""
        )}
        <button
          type="button"
          data-testid="marker-toggle-note"
          onClick={() => {
            showNote.set(!showNote.value);
          }}
        >
          Toggle insert
        </button>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

const MarkerEachPanel = defineComponent(
  "e2e-marker-each-panel",
  () => {
    const items = signal(["one", "two"]);

    return (
      <article>
        <ul data-testid="marker-list">
          {items.value.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
        <button
          type="button"
          data-testid="marker-add-item"
          onClick={() => {
            items.set([...items.value, `item-${items.value.length + 1}`]);
          }}
        >
          Add list item
        </button>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

const MarkerUpdatesFixture = defineComponent(
  "e2e-marker-updates-fixture",
  () => {
    return (
      <article>
        <p class="meta-chip">text + insert + each</p>
        <h2>Marker updates fixture</h2>
        <MarkerTextPanel />
        <MarkerInsertPanel />
        <MarkerEachPanel />
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function MarkerUpdatesRoute() {
  return (
    <main>
      <MarkerUpdatesFixture />
    </main>
  );
}

export { MarkerUpdatesRoute };
