import { useEffect, useRef } from 'preact/hooks';
import { getMessage } from '../../../common/i18n';

export function Alert({ message, visible, onDismiss, isForModal }) {
  const show = visible && !!message;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!show) {
      return;
    }

    const t = setTimeout(() => onDismissRef.current(), 5000);

    return () => clearTimeout(t);
  }, [show]);

  if (!show) {
    return null;
  }

  const text = getMessage(message) || message;
  const className = isForModal ? 'alert js-modal-alert' : 'alert js-alert';

  return (
    <div class={`${className} visible`} role="status">
      {text}
    </div>
  );
}
