import { useRef } from 'preact/hooks';
import { useSignal, useSignalEffect } from '@preact/signals';
import { Messenger } from '../../services/messenger';
import { getMessage } from '../../../common/i18n';
import { addFilterModalOpen, filters, loadOptionsData, showAlert, modalAlert, dismissModalAlert } from '../store';
import { Alert } from './Alert';

export function AddFilterModal() {
  const dialogRef = useRef(null);
  const loading = useSignal(false);
  const url = useSignal('');

  useSignalEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return
    };

    if (addFilterModalOpen.value) {
      document.body.classList.add('modal-open');
      url.value = '';
      dialog.showModal();
    } else if (dialog.open) {
      document.body.classList.remove('modal-open');
      dialog.setAttribute('closing', '');

      const onEnd = () => {
        dialog.removeAttribute('closing');
        dialog.close();
      };

      dialog.addEventListener('animationend', onEnd, { once: true });
    }
  });

  const handleClose = () => {
    addFilterModalOpen.value = false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const value = url.value.trim();

    if (!value.endsWith('.txt')) {
      showAlert('options_err_no_txt_file', true);
      return;
    }

    const existingUrls = filters.value.filter((f) => f.customUrl).map((f) => f.customUrl);

    if (existingUrls.includes(value)) {
      showAlert('options_err_already_subscribed', true);
      return;
    }

    loading.value = true;

    try {
      const filterInfo = await Messenger.checkCustomUrl(value);

      if (!filterInfo || filterInfo.errorAlreadyExists) {
        showAlert(filterInfo?.errorAlreadyExists ? 'options_err_already_subscribed' : 'options_err', true);
        return;
      }

      await Messenger.addCustomFilter({
        customUrl: value,
        name: filterInfo.filter?.name || value,
        trusted: false,
      });

      if (__IS_MV3__) {
        const limits = await Messenger.getCurrentLimits();

        if (!limits.ok) {
          showAlert('snack_on_websites_limits_exceeded_warning', false);
        }
      }

      loadOptionsData();

      addFilterModalOpen.value = false;
    } catch (err) {
      showAlert('options_err', true);
    } finally {
      loading.value = false;
    }
  };

  const alertData = modalAlert.value;

  return (
    <dialog ref={dialogRef} class="modal" id="add-filter-modal" onCancel={handleClose}>
      <div class="modal__head">
        <h2 class="modal__heading">{getMessage('options_new_filter')}</h2>

        <button type="button" class="modal__close js-close-modal-btn" aria-label="Close" onClick={handleClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <form class="modal__body" onSubmit={handleSubmit}>
        <input
          type="text"
          class="modal__input js-input-add-filter"
          placeholder={getMessage('options_enter_url_or_path')}
          value={url.value}
          onInput={(e) => (url.value = e.target.value)}
          autofocus
        />

        <button type="submit" class="btn modal__submit js-btn-add-filter" disabled={loading.value}>
          {getMessage('options_submit')}
        </button>
      </form>

      {alertData && (
        <Alert message={alertData.message} visible={alertData.visible} isForModal={true} onDismiss={dismissModalAlert} />
      )}
    </dialog>
  );
}
