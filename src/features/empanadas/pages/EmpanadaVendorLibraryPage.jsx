import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useEmpanadaVendorLibrary } from '@/features/empanadas/hooks/useEmpanadaVendorLibrary';
import {
  createEmpanadaVendor,
  deleteEmpanadaVendor,
  updateEmpanadaVendor,
} from '@/features/empanadas/services/empanadaVendorLibraryService';
import { createEmpanadaLocalId } from '@/features/empanadas/utils/empanadaUtils';
import { useAuth } from '@/hooks/useAuth';
import styles from './EmpanadaVendorLibraryPage.module.scss';

function emptyForm() {
  return { name: '', flavors: [{ id: createEmpanadaLocalId('flavor'), code: '', name: '' }] };
}

function EmpanadaVendorLibraryPage() {
  const { currentUser } = useAuth();
  const { vendors, isLoading, error: loadError } = useEmpanadaVendorLibrary(currentUser?.uid);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setForm(emptyForm());
    setEditingId('');
    setIsOpen(false);
    setError('');
  };

  const openVendor = (vendor) => {
    setForm({
      name: vendor.name || '',
      flavors: (vendor.flavors || []).map((flavor) => ({ ...flavor })),
    });
    setEditingId(vendor.id);
    setError('');
    setIsOpen(true);
  };

  const handleFlavorChange = (id, field, value) => {
    setForm((current) => ({
      ...current,
      flavors: current.flavors.map((flavor) =>
        flavor.id === id ? { ...flavor, [field]: value } : flavor,
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await updateEmpanadaVendor({
          vendorId: editingId,
          ...form,
        });
      } else {
        await createEmpanadaVendor({ userUid: currentUser.uid, ...form });
      }
      reset();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el local.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vendor) => {
    if (!window.confirm(`¿Borrar "${vendor.name}" de la biblioteca compartida? Los viajes que ya lo usan no cambian.`)) {
      return;
    }

    try {
      await deleteEmpanadaVendor({ userUid: currentUser.uid, vendor });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar el local.');
    }
  };

  return (
    <section className={styles.page}>
      <Link to="/" className={styles.backLink}>
        <FiArrowLeft aria-hidden="true" />
        Volver al inicio
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Biblioteca compartida</p>
          <h1>Locales de empanadas</h1>
          <p>Los locales se comparten automáticamente con las personas con las que los usás en un viaje.</p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setForm(emptyForm());
              setEditingId('');
              setError('');
              setIsOpen(true);
            }}
          >
            <FiPlus aria-hidden="true" />
            Nuevo local
          </button>
        </div>
      </header>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {isOpen ? (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Nombre del local</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ej: Las 40"
              required
            />
          </label>

          <div className={styles.flavorsEditor}>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2>Gustos</h2>
                <p>La sigla se usa para identificar rápido cada sabor.</p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    flavors: [
                      ...current.flavors,
                      { id: createEmpanadaLocalId('flavor'), code: '', name: '' },
                    ],
                  }))
                }
              >
                <FiPlus aria-hidden="true" />
                Agregar gusto
              </button>
            </div>

            {form.flavors.map((flavor) => (
              <div key={flavor.id} className={styles.flavorRow}>
                <label className={styles.field}>
                  <span>Sigla</span>
                  <input
                    type="text"
                    value={flavor.code}
                    maxLength={8}
                    onChange={(event) => handleFlavorChange(flavor.id, 'code', event.target.value)}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Empanada</span>
                  <input
                    type="text"
                    value={flavor.name}
                    onChange={(event) => handleFlavorChange(flavor.id, 'name', event.target.value)}
                    required
                  />
                </label>
                <button
                  type="button"
                  className={styles.iconDangerButton}
                  aria-label={`Eliminar ${flavor.name || 'gusto'}`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      flavors: current.flavors.filter((item) => item.id !== flavor.id),
                    }))
                  }
                  disabled={form.flavors.length <= 1}
                >
                  <FiTrash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar local'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={reset} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? <div className={styles.emptyState}>Cargando locales...</div> : null}
      {!isLoading && vendors.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>Todavía no cargaste ningún local.</strong>
          <span>Creá un local nuevo o usá uno que otra persona haya compartido con vos en un viaje.</span>
        </div>
      ) : null}

      {!isLoading && vendors.length > 0 ? (
        <div className={styles.cardsGrid}>
          {vendors.map((vendor) => (
            <article key={vendor.id} className={styles.vendorCard}>
              <div>
                <h2>{vendor.name}</h2>
                <p>{(vendor.flavors || []).length} gustos cargados · compartido con {(vendor.accessUserIds || []).length || 1}</p>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={styles.iconButton} onClick={() => openVendor(vendor)} aria-label={`Editar ${vendor.name}`}>
                  <FiEdit2 aria-hidden="true" />
                </button>
                {vendor.createdBy === currentUser.uid && (vendor.accessUserIds || []).length <= 1 ? (
                  <button type="button" className={styles.iconDangerButton} onClick={() => handleDelete(vendor)} aria-label={`Borrar ${vendor.name}`}>
                    <FiTrash2 aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <div className={styles.flavorPreview}>
                {(vendor.flavors || []).slice(0, 8).map((flavor) => (
                  <span key={flavor.id}><strong>{flavor.code}</strong> {flavor.name}</span>
                ))}
                {(vendor.flavors || []).length > 8 ? <small>+ {(vendor.flavors || []).length - 8} gustos más</small> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default EmpanadaVendorLibraryPage;
