/** Small DOM helpers — no business logic. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('data-')) node.setAttribute(key, value);
    else if (key.startsWith('aria-')) node.setAttribute(key, value);
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export function clearElement(node: HTMLElement): void {
  node.replaceChildren();
}
