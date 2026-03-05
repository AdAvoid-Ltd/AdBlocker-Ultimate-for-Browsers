import { render } from 'preact';

import { Options } from './components/Options';

import './index.pcss';
import '../common.pcss';

const root = document.getElementById('root');
if (root) {
  render(<Options />, root);
}
