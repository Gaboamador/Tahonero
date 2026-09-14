import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  FiAlertCircle,
  FiBox,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiLock,
  FiPackage,
  FiSettings,
  FiUnlock,
  FiUsers,
} from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import {
  getGroupMemberByUserUid,
  getGroupMembers,
  isGroupOwner,
} from '@/services/firebase/groupService';
import { getTripMealSlots } from '@/utils/tripUtils';
import { getTripRegisteredUserIds } from '@/utils/sharedLibraryUtils';
import { useEmpanadaModuleData } from '@/features/empanadas/hooks/useEmpanadaModuleData';
import { useEmpanadaVendorLibrary } from '@/features/empanadas/hooks/useEmpanadaVendorLibrary';
import {
  deleteEmpanadaOrder,
  saveEmpanadaDistribution,
  reconcileEmpanadaVendorLibraryAccess,
  saveEmpanadaMealSlots,
  saveEmpanadaOrder,
  selectEmpanadaVendor,
  setEmpanadaConsumedCount,
  setEmpanadaOrderFinalized,
} from '@/features/empanadas/services/empanadaService';
import {
  buildEmpanadaTotals,
  getMealSlotLabel,
  getOrderTotal,
  parseEmpanadaCount,
} from '@/features/empanadas/utils/empanadaUtils';
import styles from './EmpanadasPage.module.scss';

function EmpanadasPage() {
  const { group } = useOutletContext();
  const { currentUser } = useAuth();
  const { config, orders, isLoading, error: loadError } = useEmpanadaModuleData(group.id);
  const { vendors, isLoading: vendorsLoading, error: vendorsError } = useEmpanadaVendorLibrary(currentUser?.uid);
  const members = useMemo(() => getGroupMembers(group), [group]);
  const sharedUserIds = useMemo(() => getTripRegisteredUserIds(group), [group]);
  const currentMember = getGroupMemberByUserUid(group, currentUser?.uid);
  const owner = isGroupOwner(group, currentUser?.uid);
  const mealSlots = useMemo(
    () =>
      getTripMealSlots({
        startDate: group.startDate,
        endDate: group.endDate,
        firstMeal: group.firstMeal || 'lunch',
        lastMeal: group.lastMeal || 'dinner',
      }),
    [group.startDate, group.endDate, group.firstMeal, group.lastMeal],
  );
  const mealSlotsMap = useMemo(
    () => Object.fromEntries(mealSlots.map((slot) => [slot.id, slot])),
    [mealSlots],
  );
  const configuredLibraryVendor = useMemo(() => {
    if (!config) return null;
    return (
      vendors.find((vendor) => vendor.id === config.sourceVendorId) ||
      vendors.find(
        (vendor) =>
          config.sourceVendorScope !== 'shared' &&
          vendor.legacyOwnerUid === config.sourceVendorOwnerUid &&
          vendor.legacyVendorId === config.sourceVendorId,
      ) ||
      null
    );
  }, [config, vendors]);

  const [vendorId, setVendorId] = useState('');
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [managedMemberId, setManagedMemberId] = useState('');
  const [orderItems, setOrderItems] = useState({});
  const [allocations, setAllocations] = useState({});
  const [search, setSearch] = useState('');
  const [activeDistributionSlotId, setActiveDistributionSlotId] = useState('');
  const [boxViewMode, setBoxViewMode] = useState('flavor');
  const [isSaving, setIsSaving] = useState(false);
  const [savingConsumeKey, setSavingConsumeKey] = useState('');
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    if (config) {
      const migratedVendor =
        config.sourceVendorScope === 'shared'
          ? null
          : vendors.find(
              (vendor) =>
                vendor.legacyOwnerUid === config.sourceVendorOwnerUid &&
                vendor.legacyVendorId === config.sourceVendorId,
            );
      setVendorId(migratedVendor?.id || config.sourceVendorId || '');
      setSelectedSlotIds(config.mealSlotIds || []);
    }
  }, [config, vendors]);

  useEffect(() => {
    if (!owner || !config || vendorsLoading || !currentUser?.uid) return;

    reconcileEmpanadaVendorLibraryAccess({
      groupId: group.id,
      config,
      vendor: configuredLibraryVendor,
      currentUserUid: currentUser.uid,
      accessUserIds: sharedUserIds,
    }).catch((err) => {
      console.error('No se pudo sincronizar el acceso al local compartido:', err);
    });
  }, [
    owner,
    config,
    configuredLibraryVendor,
    vendorsLoading,
    currentUser?.uid,
    group.id,
    sharedUserIds,
  ]);

  const manageableMembers = useMemo(() => {
    if (!currentMember) return [];
    if (!owner) return [currentMember];
    return members.filter(
      (member) => member.memberId === currentMember.memberId || member.type === 'manual',
    );
  }, [currentMember, members, owner]);

  useEffect(() => {
    if (!managedMemberId && manageableMembers.length > 0) {
      setManagedMemberId(manageableMembers[0].memberId);
    } else if (
      managedMemberId &&
      !manageableMembers.some((member) => member.memberId === managedMemberId)
    ) {
      setManagedMemberId(manageableMembers[0]?.memberId || '');
    }
  }, [manageableMembers, managedMemberId]);

  const managedOrder = orders.find((order) => order.memberId === managedMemberId) || null;
  const managedMember = members.find((member) => member.memberId === managedMemberId) || null;

  useEffect(() => {
    setOrderItems({ ...(managedOrder?.items || {}) });
    setAllocations(
      Object.fromEntries(
        Object.entries(managedOrder?.allocations || {}).map(([slotId, slotMap]) => [
          slotId,
          { ...slotMap },
        ]),
      ),
    );
  }, [managedMemberId, managedOrder]);

  const flavors = config?.flavors || [];
  const flavorIds = flavors.map((flavor) => flavor.id);
  const filteredFlavors = flavors.filter((flavor) => {
    const query = search.trim().toLocaleLowerCase('es-AR');
    if (!query) return true;
    return `${flavor.code} ${flavor.name}`.toLocaleLowerCase('es-AR').includes(query);
  });
  const orderedFlavors = flavors.filter((flavor) => parseEmpanadaCount(orderItems[flavor.id]) > 0);
  const totals = useMemo(
    () => buildEmpanadaTotals({ config, orders, members }),
    [config, orders, members],
  );
  const totalOrdered = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalRemaining = totals.reduce((sum, flavor) => sum + flavor.remaining, 0);
  const ordersByMember = useMemo(
    () => Object.fromEntries(orders.map((order) => [order.memberId, order])),
    [orders],
  );
  const pendingOrderMembers = useMemo(
    () =>
      members.filter((member) => ordersByMember[member.memberId]?.isFinalized !== true),
    [members, ordersByMember],
  );
  const allOrdersFinalized = members.length > 0 && pendingOrderMembers.length === 0;
  const managedOrderIsFinalized = managedOrder?.isFinalized === true;
  const configuredSlotIds = useMemo(() => config?.mealSlotIds || [], [config]);
  const displayedDistributionSlotId = activeDistributionSlotId || configuredSlotIds[0] || '';
  const managedOrderedTotal = orderedFlavors.reduce(
    (sum, flavor) => sum + parseEmpanadaCount(orderItems[flavor.id]),
    0,
  );
  const managedAllocatedTotal = configuredSlotIds.reduce(
    (slotTotal, slotId) =>
      slotTotal +
      orderedFlavors.reduce(
        (flavorTotal, flavor) =>
          flavorTotal + parseEmpanadaCount(allocations?.[slotId]?.[flavor.id]),
        0,
      ),
    0,
  );
  const managedUnassignedTotal = Math.max(0, managedOrderedTotal - managedAllocatedTotal);

  useEffect(() => {
    if (configuredSlotIds.length === 0) {
      setActiveDistributionSlotId('');
      return;
    }

    if (!configuredSlotIds.includes(activeDistributionSlotId)) {
      setActiveDistributionSlotId(configuredSlotIds[0]);
    }
  }, [activeDistributionSlotId, configuredSlotIds]);

  const setAllocationCount = (slotId, flavorId, nextValue) => {
    const ordered = parseEmpanadaCount(orderItems[flavorId]);
    const allocatedElsewhere = configuredSlotIds.reduce((sum, currentSlotId) => {
      if (currentSlotId === slotId) return sum;
      return sum + parseEmpanadaCount(allocations?.[currentSlotId]?.[flavorId]);
    }, 0);
    const maxForSlot = Math.max(0, ordered - allocatedElsewhere);
    const nextCount = Math.min(parseEmpanadaCount(nextValue), maxForSlot);

    setAllocations((current) => ({
      ...current,
      [slotId]: {
        ...(current[slotId] || {}),
        [flavorId]: nextCount,
      },
    }));
  };

  const remainingByMember = useMemo(
    () =>
      members
        .map((member) => {
          const flavorsRemaining = totals
            .map((flavor) => ({
              flavor,
              count: flavor.remainingByMember[member.memberId] || 0,
            }))
            .filter((item) => item.count > 0);

          return {
            member,
            flavors: flavorsRemaining,
            total: flavorsRemaining.reduce((sum, item) => sum + item.count, 0),
          };
        })
        .filter((item) => item.total > 0),
    [members, totals],
  );

  const handleSelectVendor = async () => {
    const vendor = vendors.find((item) => item.id === vendorId);
    if (!vendor) {
      setError('Elegí un local.');
      return;
    }
    const currentCatalogSignature = JSON.stringify(
      (config?.flavors || []).map(({ id, code, name }) => [id, code, name]),
    );
    const nextCatalogSignature = JSON.stringify(
      (vendor.flavors || []).map(({ id, code, name }) => [id, code, name]),
    );
    const sameVendor =
      config?.sourceVendorId === vendor.id ||
      (config?.sourceVendorScope !== 'shared' &&
        vendor.legacyOwnerUid === config?.sourceVendorOwnerUid &&
        vendor.legacyVendorId === config?.sourceVendorId);
    const vendorOrCatalogChanges =
      config && (!sameVendor || currentCatalogSignature !== nextCatalogSignature);

    if (
      vendorOrCatalogChanges &&
      orders.length > 0 &&
      !window.confirm('Cambiar el local o actualizar su carta borra los pedidos actuales del viaje. ¿Continuar?')
    ) {
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await selectEmpanadaVendor({
        groupId: group.id,
        vendor,
        currentUserUid: currentUser.uid,
        accessUserIds: sharedUserIds,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo configurar el local.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSlots = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveEmpanadaMealSlots({
        groupId: group.id,
        config,
        mealSlots,
        selectedSlotIds,
        currentUserUid: currentUser.uid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudieron guardar las comidas de empanadas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!managedMemberId) return;
    setIsSaving(true);
    setError('');
    try {
      await saveEmpanadaOrder({
        groupId: group.id,
        memberId: managedMemberId,
        items: orderItems,
        allocations: managedOrder?.allocations || {},
        consumed: managedOrder?.consumed || {},
        flavorIds,
        currentUserUid: currentUser.uid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalizeOrder = async () => {
    if (!managedMemberId) return;

    setIsSaving(true);
    setError('');
    try {
      await saveEmpanadaOrder({
        groupId: group.id,
        memberId: managedMemberId,
        items: orderItems,
        allocations: managedOrder?.allocations || {},
        consumed: managedOrder?.consumed || {},
        flavorIds,
        currentUserUid: currentUser.uid,
        isFinalized: true,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo cerrar el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenOrder = async () => {
    if (!managedOrder) return;

    setIsSaving(true);
    setError('');
    try {
      await setEmpanadaOrderFinalized({
        groupId: group.id,
        order: managedOrder,
        flavorIds,
        isFinalized: false,
        currentUserUid: currentUser.uid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo reabrir el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyOrder = async () => {
    if (!allOrdersFinalized) return;

    const lines = [
      `Pedido ${config?.vendorName || 'de empanadas'} — ${totalOrdered} empanadas`,
      '',
      ...totals.map((flavor) => `${flavor.total} ${flavor.name} (${flavor.code})`),
    ];

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API no disponible');
      }
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyFeedback('Pedido copiado');
      window.setTimeout(() => setCopyFeedback(''), 2200);
    } catch (err) {
      console.error(err);
      setError('No se pudo copiar el pedido.');
    }
  };

  const handleDeleteOrder = async () => {
    if (!managedOrder) return;
    if (!window.confirm(`¿Borrar el pedido de ${managedMember?.displayName || 'este participante'}?`)) {
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await deleteEmpanadaOrder({ groupId: group.id, memberId: managedOrder.memberId });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo borrar el pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDistribution = async () => {
    if (!managedOrder) return;
    setIsSaving(true);
    setError('');
    try {
      await saveEmpanadaDistribution({
        groupId: group.id,
        order: managedOrder,
        allocations,
        flavorIds,
        currentUserUid: currentUser.uid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo guardar la distribución.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConsume = async ({ slotId, flavorId, nextCount }) => {
    if (!managedOrder) return;
    const key = `${slotId}:${flavorId}`;
    setSavingConsumeKey(key);
    setError('');
    try {
      await setEmpanadaConsumedCount({
        groupId: group.id,
        order: managedOrder,
        slotId,
        flavorId,
        count: nextCount,
        flavorIds,
        currentUserUid: currentUser.uid,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo actualizar el consumo.');
    } finally {
      setSavingConsumeKey('');
    }
  };

  if (isLoading) {
    return <div className={styles.statusCard}>Cargando Empanadas...</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.moduleHeader}>
        <div>
          <p className={styles.eyebrow}>Módulo</p>
          <h2>Empanadas</h2>
          <p>Armá el pedido, repartilo entre las comidas y controlá qué queda en la caja.</p>
        </div>
        <FiPackage aria-hidden="true" />
      </header>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {vendorsError ? <p className={styles.error}>{vendorsError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}><FiSettings aria-hidden="true" /></div>
          <div>
            <h3>1. Local y comidas</h3>
            <p>El local y las tandas de empanadas son comunes para todo el viaje.</p>
          </div>
        </div>

        {config ? (
          <div className={styles.currentVendor}>
            <span>Local elegido</span>
            <strong>{config.vendorName}</strong>
            <small>{flavors.length} gustos disponibles</small>
          </div>
        ) : null}

        {owner ? (
          <div className={styles.configGrid}>
            <div className={styles.configBlock}>
              <label className={styles.field}>
                <span>Local de empanadas</span>
                <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={vendorsLoading}>
                  <option value="">Elegir local</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <div className={styles.inlineActions}>
                <button type="button" className={styles.primaryButton} onClick={handleSelectVendor} disabled={isSaving || !vendorId}>
                  {config ? 'Usar este local' : 'Elegir local'}
                </button>
                <Link to="/biblioteca-empanadas" className={styles.secondaryLink}>Administrar locales</Link>
              </div>
              {vendors.length === 0 ? <small>No tenés locales guardados. Podés cargar Las 40 desde la biblioteca.</small> : null}
            </div>

            {config ? (
              <div className={styles.configBlock}>
                <span className={styles.fieldLabel}>¿En qué comidas van a comer empanadas?</span>
                <div className={styles.slotChecklist}>
                  {mealSlots.map((slot) => (
                    <label key={slot.id}>
                      <input
                        type="checkbox"
                        checked={selectedSlotIds.includes(slot.id)}
                        onChange={(event) =>
                          setSelectedSlotIds((current) =>
                            event.target.checked
                              ? [...current, slot.id]
                              : current.filter((id) => id !== slot.id),
                          )
                        }
                      />
                      <span>{getMealSlotLabel(slot)}</span>
                    </label>
                  ))}
                </div>
                <button type="button" className={styles.primaryButton} onClick={handleSaveSlots} disabled={isSaving}>
                  Guardar comidas
                </button>
                <small>Estos slots también quedan marcados como “Empanadas” en el Plan diario. Si tenían otra comida asignada, se reemplaza.</small>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.readOnlyConfig}>
            {config ? (
              <>
                <strong>{config.vendorName}</strong>
                <span>
                  {(config.mealSlotIds || []).length > 0
                    ? (config.mealSlotIds || []).map((id) => getMealSlotLabel(mealSlotsMap[id])).filter(Boolean).join(' · ')
                    : 'Todavía no se definieron las comidas de empanadas.'}
                </span>
              </>
            ) : <span>El administrador todavía no eligió el local.</span>}
          </div>
        )}
      </section>

      {config ? (
        <>
          <section className={`${styles.panel} ${styles.orderSummaryPanel}`}>
            <div className={styles.orderSummaryHeader}>
              <div>
                <p className={styles.summaryEyebrow}>Para hacer el pedido</p>
                <h3>2. Pedido a realizar</h3>
                <p>Resumen compacto de lo que hay que pedir en {config.vendorName}.</p>
              </div>
              <div className={styles.orderSummaryTotal}>
                <strong>{totalOrdered}</strong>
                <span>empanadas · {totals.length} gustos</span>
              </div>
            </div>

            <div
              className={`${styles.orderReadiness} ${
                allOrdersFinalized ? styles.orderReady : styles.orderPending
              }`}
            >
              {allOrdersFinalized ? (
                <FiCheckCircle aria-hidden="true" />
              ) : (
                <FiAlertCircle aria-hidden="true" />
              )}
              <div>
                <strong>{allOrdersFinalized ? 'Listo para pedir' : 'Pedido incompleto'}</strong>
                <span>
                  {allOrdersFinalized
                    ? 'Todos los participantes cerraron su pedido.'
                    : `Falta cerrar: ${pendingOrderMembers
                        .map((member) => member.displayName || member.email || 'Participante')
                        .join(', ')}.`}
                </span>
              </div>
            </div>

            <div className={styles.orderStatusList} aria-label="Estado de pedidos">
              {members.map((member) => {
                const finalized = ordersByMember[member.memberId]?.isFinalized === true;
                return (
                  <span
                    key={member.memberId}
                    className={finalized ? styles.closedOrderChip : styles.openOrderChip}
                  >
                    {finalized ? <FiCheck aria-hidden="true" /> : <FiAlertCircle aria-hidden="true" />}
                    {member.displayName || member.email || 'Participante'}
                  </span>
                );
              })}
            </div>

            {totals.length > 0 ? (
              <div className={styles.orderToPlaceList}>
                {totals.map((flavor) => (
                  <div key={flavor.id} className={styles.orderToPlaceRow}>
                    <strong>{flavor.total}</strong>
                    <span>{flavor.name}</span>
                    <small>({flavor.code})</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Todavía no hay empanadas cargadas en los pedidos.</div>
            )}

            <div className={styles.copyOrderRow}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleCopyOrder}
                disabled={!allOrdersFinalized || totals.length === 0}
              >
                <FiCopy aria-hidden="true" />
                {copyFeedback || 'Copiar pedido'}
              </button>
              {!allOrdersFinalized ? (
                <small>Se habilita cuando todos hayan cerrado su pedido.</small>
              ) : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}><FiUsers aria-hidden="true" /></div>
              <div>
                <h3>3. Pedido individual</h3>
                <p>Cada persona elige cantidades entre los gustos disponibles y luego cierra su pedido.</p>
              </div>
            </div>

            {manageableMembers.length > 1 ? (
              <label className={styles.fieldSmall}>
                <span>Pedido que estás administrando</span>
                <select value={managedMemberId} onChange={(event) => setManagedMemberId(event.target.value)}>
                  {manageableMembers.map((member) => (
                    <option key={member.memberId} value={member.memberId}>{member.displayName || member.email}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div
              className={`${styles.managedOrderStatus} ${
                managedOrderIsFinalized ? styles.managedOrderClosed : styles.managedOrderOpen
              }`}
            >
              {managedOrderIsFinalized ? <FiLock aria-hidden="true" /> : <FiUnlock aria-hidden="true" />}
              <div>
                <strong>{managedOrderIsFinalized ? 'Pedido cerrado' : 'Pedido abierto'}</strong>
                <span>
                  {managedOrderIsFinalized
                    ? 'Este pedido ya fue confirmado. Reabrilo si necesitás cambiar cantidades.'
                    : 'Cuando estés seguro de que no vas a cambiarlo más, cerrá el pedido.'}
                </span>
              </div>
            </div>

            <div className={styles.orderTopRow}>
              <label className={styles.searchField}>
                <span>Buscar gusto</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej: pollo, HCH..." />
              </label>
              <div className={styles.orderTotal}><span>Total de {managedMember?.displayName || 'pedido'}</span><strong>{Object.values(orderItems).reduce((sum, value) => sum + parseEmpanadaCount(value), 0)}</strong></div>
            </div>

            <div className={styles.flavorOrderList}>
              {filteredFlavors.map((flavor) => (
                <label key={flavor.id} className={styles.flavorOrderRow}>
                  <strong>{flavor.code}</strong>
                  <span>{flavor.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={orderItems[flavor.id] ?? ''}
                    placeholder="0"
                    onChange={(event) => setOrderItems((current) => ({ ...current, [flavor.id]: event.target.value }))}
                    disabled={managedOrderIsFinalized || isSaving}
                  />
                </label>
              ))}
            </div>

            <div className={styles.inlineActions}>
              {managedOrderIsFinalized ? (
                <button
                  type="button"
                  className={styles.secondaryActionButton}
                  onClick={handleReopenOrder}
                  disabled={isSaving}
                >
                  <FiUnlock aria-hidden="true" />
                  Reabrir pedido
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSaveOrder}
                    disabled={isSaving || !managedMemberId}
                  >
                    Guardar pedido
                  </button>
                  <button
                    type="button"
                    className={styles.closeOrderButton}
                    onClick={handleFinalizeOrder}
                    disabled={isSaving || !managedMemberId}
                  >
                    <FiLock aria-hidden="true" />
                    Terminé · cerrar pedido
                  </button>
                  {managedOrder ? (
                    <button type="button" className={styles.dangerButton} onClick={handleDeleteOrder} disabled={isSaving}>
                      Borrar pedido
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}><FiBox aria-hidden="true" /></div>
              <div>
                <h3>4. Reparto por comida</h3>
                <p>Distribuí lo pedido entre las tandas de empanadas del viaje.</p>
              </div>
            </div>

            {!managedOrder ? <div className={styles.emptyState}>Primero guardá el pedido.</div> : null}
            {managedOrder && (config.mealSlotIds || []).length === 0 ? <div className={styles.emptyState}>Primero definan en qué comidas van a comer empanadas.</div> : null}
            {managedOrder && (config.mealSlotIds || []).length > 0 && orderedFlavors.length === 0 ? <div className={styles.emptyState}>Este pedido todavía no tiene empanadas.</div> : null}

            {managedOrder && (config.mealSlotIds || []).length > 0 && orderedFlavors.length > 0 ? (
              <div className={styles.distributionWrap}>
                <div className={styles.distributionTable} style={{ '--slot-count': Math.max(1, configuredSlotIds.length) }}>
                  <div className={styles.distributionHeader}>
                    <span>Gusto</span>
                    {configuredSlotIds.map((slotId) => <span key={slotId}>{getMealSlotLabel(mealSlotsMap[slotId])}</span>)}
                    <span>Sin asignar</span>
                  </div>
                  {orderedFlavors.map((flavor) => {
                    const ordered = parseEmpanadaCount(orderItems[flavor.id]);
                    const allocated = configuredSlotIds.reduce(
                      (sum, slotId) => sum + parseEmpanadaCount(allocations?.[slotId]?.[flavor.id]),
                      0,
                    );
                    return (
                      <div key={flavor.id} className={styles.distributionRow}>
                        <span><strong>{flavor.code}</strong> {flavor.name}<small>Pedidas: {ordered}</small></span>
                        {configuredSlotIds.map((slotId) => (
                          <input
                            key={slotId}
                            type="number"
                            min="0"
                            step="1"
                            value={allocations?.[slotId]?.[flavor.id] ?? ''}
                            placeholder="0"
                            onChange={(event) => setAllocationCount(slotId, flavor.id, event.target.value)}
                          />
                        ))}
                        <strong className={allocated === ordered ? styles.complete : styles.pending}>{Math.max(0, ordered - allocated)}</strong>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.mobileDistribution}>
                  <div className={styles.distributionSlotTabs} role="tablist" aria-label="Comida a repartir">
                    {configuredSlotIds.map((slotId) => {
                      const slotTotal = orderedFlavors.reduce(
                        (sum, flavor) => sum + parseEmpanadaCount(allocations?.[slotId]?.[flavor.id]),
                        0,
                      );
                      return (
                        <button
                          key={slotId}
                          type="button"
                          role="tab"
                          aria-selected={activeDistributionSlotId === slotId}
                          className={activeDistributionSlotId === slotId ? styles.activeSlotTab : ''}
                          onClick={() => setActiveDistributionSlotId(slotId)}
                        >
                          <span>{getMealSlotLabel(mealSlotsMap[slotId])}</span>
                          <small>{slotTotal} asignadas</small>
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.mobileDistributionList}>
                    {orderedFlavors.map((flavor) => {
                      const ordered = parseEmpanadaCount(orderItems[flavor.id]);
                      const currentCount = parseEmpanadaCount(
                        allocations?.[displayedDistributionSlotId]?.[flavor.id],
                      );
                      const allocatedElsewhere = configuredSlotIds.reduce(
                        (sum, slotId) =>
                          slotId === displayedDistributionSlotId
                            ? sum
                            : sum + parseEmpanadaCount(allocations?.[slotId]?.[flavor.id]),
                        0,
                      );
                      const maxForActiveSlot = Math.max(0, ordered - allocatedElsewhere);

                      return (
                        <article key={flavor.id} className={styles.mobileDistributionRow}>
                          <div className={styles.mobileDistributionInfo}>
                            <div><strong>{flavor.code}</strong><span>{flavor.name}</span></div>
                            <small>
                              Pediste {ordered}
                              {allocatedElsewhere > 0 ? ` · ${allocatedElsewhere} en otras comidas` : ''}
                            </small>
                          </div>

                          <div className={styles.stepper} aria-label={`Cantidad de ${flavor.name}`}>
                            <button
                              type="button"
                              onClick={() => setAllocationCount(displayedDistributionSlotId, flavor.id, currentCount - 1)}
                              disabled={currentCount <= 0}
                              aria-label={`Quitar una ${flavor.name}`}
                            >
                              −
                            </button>
                            <strong>{currentCount}</strong>
                            <button
                              type="button"
                              onClick={() => setAllocationCount(displayedDistributionSlotId, flavor.id, currentCount + 1)}
                              disabled={currentCount >= maxForActiveSlot}
                              aria-label={`Agregar una ${flavor.name}`}
                            >
                              +
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <button type="button" className={`${styles.primaryButton} ${styles.desktopDistributionSave}`} onClick={handleSaveDistribution} disabled={isSaving}>
                  Guardar reparto
                </button>

                <div className={styles.distributionStickyBar}>
                  <span>
                    <strong>{managedOrderedTotal}</strong> pedidas · <strong>{managedAllocatedTotal}</strong> repartidas ·{' '}
                    <strong className={managedUnassignedTotal === 0 ? styles.complete : styles.pending}>
                      {managedUnassignedTotal}
                    </strong>{' '}
                    sin asignar
                  </span>
                  <button type="button" className={styles.primaryButton} onClick={handleSaveDistribution} disabled={isSaving}>
                    Guardar reparto
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}><FiCheck aria-hidden="true" /></div>
              <div>
                <h3>5. Consumo</h3>
                <p>Marcá cada empanada a medida que se consume.</p>
              </div>
            </div>

            {!managedOrder || Object.keys(managedOrder.allocations || {}).length === 0 ? (
              <div className={styles.emptyState}>Todavía no hay empanadas repartidas entre comidas.</div>
            ) : (
              <div className={styles.consumptionMeals}>
                {(config.mealSlotIds || []).map((slotId) => {
                  const slotAllocations = managedOrder.allocations?.[slotId] || {};
                  const slotFlavors = flavors.filter((flavor) => parseEmpanadaCount(slotAllocations[flavor.id]) > 0);
                  if (slotFlavors.length === 0) return null;
                  return (
                    <article key={slotId} className={styles.consumptionCard}>
                      <h4>{getMealSlotLabel(mealSlotsMap[slotId])}</h4>
                      {slotFlavors.map((flavor) => {
                        const allocated = parseEmpanadaCount(slotAllocations[flavor.id]);
                        const consumed = parseEmpanadaCount(managedOrder.consumed?.[slotId]?.[flavor.id]);
                        const key = `${slotId}:${flavor.id}`;
                        return (
                          <div key={flavor.id} className={styles.consumeRow}>
                            <span><strong>{flavor.code}</strong> {flavor.name}</span>
                            <div className={styles.consumeChecks}>
                              {Array.from({ length: allocated }, (_, index) => {
                                const checked = index < consumed;
                                return (
                                  <label key={index} title={`${flavor.name} ${index + 1}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={savingConsumeKey === key}
                                      onChange={() => handleConsume({
                                        slotId,
                                        flavorId: flavor.id,
                                        nextCount: checked ? index : index + 1,
                                      })}
                                    />
                                    <span>{index + 1}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}><FiPackage aria-hidden="true" /></div>
              <div>
                <h3>6. Pedido general y caja</h3>
                <p>{totalOrdered} pedidas · {totalRemaining} todavía disponibles.</p>
              </div>
            </div>

            {totals.length === 0 ? <div className={styles.emptyState}>Todavía nadie cargó empanadas.</div> : (
              <>
                <div className={styles.generalSectionHeader}>
                  <div>
                    <h4>Pedido general</h4>
                    <p>Qué pidió cada persona y cuánto queda disponible por gusto.</p>
                  </div>
                </div>

                <div className={styles.generalTableWrap}>
                  <table className={styles.generalTable}>
                    <thead>
                      <tr>
                        <th>Sigla</th><th>Empanada</th><th>Total</th><th>Quedan</th>
                        {members.map((member) => <th key={member.memberId}>{member.displayName || member.email}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((flavor) => (
                        <tr key={flavor.id}>
                          <td><strong>{flavor.code}</strong></td>
                          <td>{flavor.name}</td>
                          <td><strong>{flavor.total}</strong></td>
                          <td className={flavor.remaining > 0 ? styles.remaining : styles.finished}>{flavor.remaining}</td>
                          {members.map((member) => <td key={member.memberId}>{flavor.byMember[member.memberId] || ''}</td>)}
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>—</td><td>TOTAL</td><td>{totalOrdered}</td><td>{totalRemaining}</td>
                        {members.map((member) => {
                          const order = orders.find((item) => item.memberId === member.memberId);
                          return <td key={member.memberId}>{order ? getOrderTotal(order) : ''}</td>;
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.generalMobileList}>
                  {totals.map((flavor) => (
                    <article key={flavor.id} className={styles.generalMobileCard}>
                      <div className={styles.generalMobileCardHeader}>
                        <div><strong>{flavor.code}</strong><span>{flavor.name}</span></div>
                        <div className={styles.generalMobileTotals}>
                          <span>{flavor.total} pedidas</span>
                          <b className={flavor.remaining > 0 ? styles.remaining : styles.finished}>
                            {flavor.remaining} quedan
                          </b>
                        </div>
                      </div>
                      <ul>
                        {members.map((member) => {
                          const count = flavor.byMember[member.memberId] || 0;
                          return count > 0 ? (
                            <li key={member.memberId}>
                              <span>{member.displayName || member.email}</span>
                              <strong>{count}</strong>
                            </li>
                          ) : null;
                        })}
                      </ul>
                    </article>
                  ))}
                </div>

                <div className={styles.boxSectionHeader}>
                  <div>
                    <h4>Qué queda en la caja</h4>
                    <p>{totalRemaining} empanadas todavía disponibles.</p>
                  </div>
                  <div className={styles.viewToggle} aria-label="Agrupar caja">
                    <button
                      type="button"
                      className={boxViewMode === 'flavor' ? styles.activeViewToggle : ''}
                      onClick={() => setBoxViewMode('flavor')}
                    >
                      Por sabor
                    </button>
                    <button
                      type="button"
                      className={boxViewMode === 'member' ? styles.activeViewToggle : ''}
                      onClick={() => setBoxViewMode('member')}
                    >
                      Por persona
                    </button>
                  </div>
                </div>

                {totalRemaining === 0 ? (
                  <div className={styles.emptyState}>No quedan empanadas en la caja.</div>
                ) : boxViewMode === 'flavor' ? (
                  <div className={styles.boxGrid}>
                    {totals.filter((flavor) => flavor.remaining > 0).map((flavor) => (
                      <article key={flavor.id} className={styles.boxCard}>
                        <div><strong>{flavor.code}</strong><span>{flavor.name}</span></div>
                        <b>{flavor.remaining}</b>
                        <ul>
                          {members.map((member) => {
                            const count = flavor.remainingByMember[member.memberId] || 0;
                            return count > 0 ? <li key={member.memberId}>{member.displayName || member.email}: {count}</li> : null;
                          })}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.boxGrid}>
                    {remainingByMember.map(({ member, flavors: memberFlavors, total }) => (
                      <article key={member.memberId} className={styles.memberBoxCard}>
                        <div className={styles.memberBoxHeader}>
                          <strong>{member.displayName || member.email}</strong>
                          <b>{total}</b>
                        </div>
                        <ul>
                          {memberFlavors.map(({ flavor, count }) => (
                            <li key={flavor.id}>
                              <span><strong>{flavor.code}</strong> {flavor.name}</span>
                              <b>{count}</b>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      ) : (
        <div className={styles.emptyState}>Primero elijan un local de empanadas para este viaje.</div>
      )}
    </div>
  );
}

export default EmpanadasPage;
