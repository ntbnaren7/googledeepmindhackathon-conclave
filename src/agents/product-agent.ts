import { BaseAgent } from './base-agent';

export class ProductAgent extends BaseAgent {
  id = 'prod-1';
  role = 'product';
  responsibilities = ['User value', 'UX'];
}
