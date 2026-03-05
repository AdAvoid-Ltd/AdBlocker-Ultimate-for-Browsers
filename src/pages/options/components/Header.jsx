import { useSignal, useComputed } from '@preact/signals';
import { getMessage } from '../../../common/i18n';
import { formatDate } from '../filters/utils';
import { filtersInfo, loadOptionsData, showAlert } from '../store';
import { Messenger } from '../../services/messenger';

export function Header() {
  const updating = useSignal(false);
  const rulesCount = useComputed(() =>
    (filtersInfo.value?.rulesCount ?? 0).toLocaleString('en-US')
  );
  const updateDate = useComputed(() =>
    formatDate(filtersInfo.value?.latestCheckTime ?? 0)
  );

  const handleUpdateClick = async () => {
    const MIN_DISPLAY_MS = 1000;
    const startTime = Date.now();

    updating.value = true;

    try {
      const updatedFilters = await Messenger.updateFilters();
      const remaining = Math.max(0, MIN_DISPLAY_MS - (Date.now() - startTime));

      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }

      const count = updatedFilters?.length ?? 0;
      const message =
        count === 1
          ? getMessage('options_filters_updated_single', [count])
          : getMessage('options_filters_updated', [count]);

      showAlert(message || `Updated ${count} filter${count === 1 ? '' : 's'}`);
    } catch (error) {
      showAlert(getMessage('options_filters_update_error') || 'Error updating filters');
    } finally {
      updating.value = false;

      loadOptionsData();
    }
  };

  return (
    <header class="header">
      <div class="logo">
        <img src="/assets/images/logo-black.png" alt="" />
      </div>

      <div class="stats">
        <div class="stats__text">
          <div class="stats__line js-filter-rules-count">
            {getMessage('options_built_in_rules_limit', [rulesCount.value])}
          </div>

          <div class="stats__line js-filter-update-date">{updateDate}</div>
        </div>

        {!__IS_MV3__ && (
          <button
            type="button"
            class={`stats__refresh js-btn-update-filters ${updating.value ? 'active' : ''}`}
            onClick={handleUpdateClick}
            disabled={updating.value}
          >
            <img src="/assets/images/reload-icon.svg" alt="" />
          </button>
        )}
      </div>
    </header>
  );
}
