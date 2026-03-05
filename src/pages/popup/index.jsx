import { render } from 'preact';

import { Popup } from './components/Popup';

import '../common.pcss';
import './index.pcss';

const root = document.getElementById('root');

if (root) {
  render(<Popup />, root);
}
