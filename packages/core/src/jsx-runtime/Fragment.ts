/**
 * JSX Fragment component.
 */
import { templateEffect } from "@dathra/reactivity";

type JSXChild =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | (() => unknown);

interface FragmentProps {
  children?: JSXChild | JSXChild[];
}

/**
 * Fragment renders children without a wrapper element.
 * Function children are treated as reactive getters and kept in sync via templateEffect.
 */
export function Fragment(props: FragmentProps): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const { children } = props;

  function appendChild(child: JSXChild): void {
    if (child === null || child === undefined || typeof child === "boolean") {
      return;
    }

    if (child instanceof Node) {
      fragment.appendChild(child);
    } else if (typeof child === "function") {
      // Reactive getter: create a text node and keep it updated via templateEffect
      const textNode = document.createTextNode(String(child()));
      fragment.appendChild(textNode);
      templateEffect(() => {
        textNode.nodeValue = String(child());
      });
    } else {
      fragment.appendChild(document.createTextNode(String(child)));
    }
  }

  if (Array.isArray(children)) {
    children.forEach(appendChild);
  } else if (children !== undefined) {
    appendChild(children);
  }

  return fragment;
}
