import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FiLink, FiTrash2, FiUsers } from 'react-icons/fi';
import AddMemberForm from '@/components/AddMemberForm';
import AddRegisteredUserForm from '@/components/AddRegisteredUserForm';
import { useGroupExpenses } from '@/hooks/useGroupExpenses';
import {
  getGroupMembers,
  linkManualMemberToRegisteredUser,
  removeManualMemberFromGroup,
} from '@/services/firebase/groupService';
import styles from './TripMembersPage.module.scss';

function TripMembersPage() {
  const { group } = useOutletContext();
  const { expenses, expensesLoading } = useGroupExpenses(group.id);

  const [memberActionError, setMemberActionError] = useState('');
  const [deletingMemberId, setDeletingMemberId] = useState('');
  const [linkingMemberId, setLinkingMemberId] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const members = getGroupMembers(group);

  const handleRemoveMember = async (member) => {
    const shouldRemove = window.confirm(
      `¿Eliminar a "${member.displayName || member.email || 'este participante'}" del viaje?`,
    );

    if (!shouldRemove) {
      return;
    }

    setMemberActionError('');
    setDeletingMemberId(member.uid);

    try {
      await removeManualMemberFromGroup({
        group,
        memberId: member.uid,
        expenses,
      });
    } catch (error) {
      console.error(error);
      setMemberActionError(error.message || 'No se pudo eliminar el participante.');
    } finally {
      setDeletingMemberId('');
    }
  };

  const handleOpenLinkMember = (member) => {
    setMemberActionError('');
    setLinkingMemberId(member.uid);
    setLinkEmail(member.email || '');
  };

  const handleCancelLinkMember = () => {
    setMemberActionError('');
    setLinkingMemberId('');
    setLinkEmail('');
  };

  const handleLinkMember = async (event) => {
    event.preventDefault();
    setMemberActionError('');
    setIsLinking(true);

    try {
      await linkManualMemberToRegisteredUser({
        group,
        manualMemberId: linkingMemberId,
        email: linkEmail,
        expenses,
      });

      setLinkingMemberId('');
      setLinkEmail('');
    } catch (error) {
      console.error(error);
      setMemberActionError(error.message || 'No se pudo vincular el participante.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelIcon}>
            <FiUsers aria-hidden="true" />
          </div>
          <div>
            <p className={styles.eyebrow}>Viaje</p>
            <h2>Participantes</h2>
            <p>
              {members.length === 1
                ? '1 persona participa del viaje.'
                : `${members.length} personas participan del viaje.`}
            </p>
          </div>
        </div>

        <div className={styles.formsGrid}>
          <AddRegisteredUserForm group={group} />
          <AddMemberForm groupId={group.id} />
        </div>

        {memberActionError ? <p className={styles.error}>{memberActionError}</p> : null}

        <ul className={styles.membersList}>
          {members.map((member) => {
            const canDeleteMember = member.type === 'manual' && member.role !== 'owner';
            const canLinkMember = member.type === 'manual';

            return (
              <li key={member.uid} className={styles.memberItem}>
                <div className={styles.avatar}>
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" />
                  ) : (
                    <span>{(member.displayName || member.email || 'U').charAt(0)}</span>
                  )}
                </div>

                <div className={styles.memberInfo}>
                  <strong>{member.displayName || member.email || 'Usuario'}</strong>
                  {member.email ? <span>{member.email}</span> : null}
                </div>

                <div className={styles.memberRight}>
                  <div className={styles.badges}>
                    {member.type === 'manual' ? <span className={styles.typeBadge}>Manual</span> : null}
                    {member.role === 'owner' ? <span className={styles.roleBadge}>Admin</span> : null}
                  </div>

                  <div className={styles.memberActions}>
                    {canLinkMember ? (
                      <button
                        type="button"
                        className={styles.memberLinkButton}
                        onClick={() => handleOpenLinkMember(member)}
                        disabled={expensesLoading || isLinking}
                        aria-label={`Vincular participante ${member.displayName || member.email}`}
                      >
                        <FiLink aria-hidden="true" />
                      </button>
                    ) : null}

                    {canDeleteMember ? (
                      <button
                        type="button"
                        className={styles.memberDeleteButton}
                        onClick={() => handleRemoveMember(member)}
                        disabled={deletingMemberId === member.uid || expensesLoading || isLinking}
                        aria-label={`Eliminar participante ${member.displayName || member.email}`}
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {linkingMemberId === member.uid ? (
                  <form className={styles.linkMemberForm} onSubmit={handleLinkMember}>
                    <label>
                      <span>Email del usuario registrado</span>
                      <input
                        type="email"
                        value={linkEmail}
                        onChange={(event) => setLinkEmail(event.target.value)}
                        placeholder="usuario@email.com"
                        required
                      />
                    </label>

                    <div className={styles.linkMemberActions}>
                      <button type="submit" disabled={isLinking}>
                        {isLinking ? 'Vinculando...' : 'Vincular'}
                      </button>
                      <button type="button" onClick={handleCancelLinkMember} disabled={isLinking}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default TripMembersPage;
