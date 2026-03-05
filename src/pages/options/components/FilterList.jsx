import { memo } from 'preact/compat';
import { IconExternalLink, IconDelete } from '../../../resources/svg-icons';

export const FilterList = memo(function FilterList({ filters, onToggle, onDelete }) {
  return (
    <ul class="options js-options-search-result">
      {filters.map((filter) => (
        <li key={filter.filterId} class="options__option">
          <div class="options__text">
            <h2>
              {filter.name || ''}
              {filter.customUrl && (
                <>
                  <a class="options__external" href={filter.customUrl} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink class="icon" />
                  </a>

                  <IconDelete
                    class="icon options__delete js-btn-delete"
                    role="button"
                    tabIndex={0}
                    onClick={() => onDelete(filter.filterId)}
                    onKeyDown={(e) => e.key === 'Enter' && onDelete(filter.filterId)}
                  />
                </>
              )}
            </h2>

            {filter.description && <p>{filter.description}</p>}
          </div>

          <div
            class={`toggle ${filter.enabled ? 'toggle--checked' : ''}`}
            onClick={() => onToggle(filter)}
          >
            <div class="toggle__label" />
          </div>
        </li>
      ))}
    </ul>
  );
});
