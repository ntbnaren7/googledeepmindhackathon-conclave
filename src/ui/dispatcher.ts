import type { UIComponent, UIMessage } from './types';

/**
 * Routes incoming UIMessages to the registered panel components. Each component
 * declares the message kinds it cares about; the dispatcher fans a message out
 * to every component that opted in. A failing component never blocks the others.
 */
export class Dispatcher {
  private readonly components: UIComponent[] = [];

  register(component: UIComponent, root: HTMLElement | null): void {
    if (!root) return;
    component.mount(root);
    this.components.push(component);
  }

  route(msg: UIMessage): void {
    for (const component of this.components) {
      if (!component.kinds.includes(msg.kind)) continue;
      try {
        component.handle(msg);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[dispatcher] component error', err);
      }
    }
  }
}
