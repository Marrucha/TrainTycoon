import { useState, useEffect, useRef, useMemo } from 'react'
import { useGame } from '../../context/GameContext'
import { useChat } from './useChat'
import styles from './Chat.module.css'
import { auth } from '../../firebase/config'

// ── helpers ────────────────────────────────────────────────────────────────

const tsFormat = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const hm = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? hm : `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${hm}`
}

// ── sub-components ──────────────────────────────────────────────────────────

function GroupList({ groups, activeId, onSelect, onNew, myUid }) {
    return (
        <div className={styles.groupList}>
            <div className={styles.groupListHeader}>
                <span>Rozmowy</span>
                <button className={styles.newGroupBtn} onClick={onNew} title="Nowa grupa">＋</button>
            </div>
            {groups.length === 0 && (
                <div className={styles.emptyGroups}>Brak rozmów. Utwórz pierwszą.</div>
            )}
            {groups.map(g => {
                const unread = g.unread?.[myUid] || 0
                return (
                    <div
                        key={g.id}
                        className={`${styles.groupItem} ${g.id === activeId ? styles.groupItemActive : ''}`}
                        onClick={() => onSelect(g.id)}
                    >
                        <div className={styles.groupItemName}>{g.name}</div>
                        <div className={styles.groupItemMeta}>
                            <span className={styles.groupMemberCount}>{g.members?.length || 0} os.</span>
                            {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function MessageList({ messages, myUid, messagesEndRef }) {
    if (messages.length === 0) {
        return <div className={styles.emptyMessages}>Brak wiadomości. Napisz pierwszą!</div>
    }
    let lastDate = null
    return (
        <div className={styles.messageList}>
            {messages.map(msg => {
                const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt || 0)
                const dateStr = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
                const showDate = dateStr !== lastDate
                lastDate = dateStr
                const isMe = msg.authorUid === myUid
                return (
                    <div key={msg.id}>
                        {showDate && <div className={styles.dateDivider}>{dateStr}</div>}
                        <div className={`${styles.message} ${isMe ? styles.messageMe : styles.messageOther}`}>
                            {!isMe && <div className={styles.messageAuthor}>{msg.authorName}</div>}
                            <div className={styles.messageBubble}>{msg.text}</div>
                            <div className={styles.messageTime}>{tsFormat(msg.createdAt)}</div>
                        </div>
                    </div>
                )
            })}
            <div ref={messagesEndRef} />
        </div>
    )
}

function NewGroupModal({ allPlayers, myUid, onCreate, onClose }) {
    const [name, setName] = useState('')
    const [selected, setSelected] = useState([])

    const toggle = (uid) => setSelected(prev =>
        prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )

    const handleCreate = () => {
        if (!name.trim()) return
        onCreate(name.trim(), selected)
    }

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Nowa rozmowa</h3>

                <label className={styles.modalLabel}>Nazwa grupy</label>
                <input
                    className={styles.modalInput}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="np. Sojusz Północny"
                    autoFocus
                />

                <label className={styles.modalLabel}>Dodaj graczy</label>
                <div className={styles.playerList}>
                    {allPlayers.filter(p => p.uid !== myUid).map(p => (
                        <div
                            key={p.uid}
                            className={`${styles.playerItem} ${selected.includes(p.uid) ? styles.playerItemSelected : ''}`}
                            onClick={() => toggle(p.uid)}
                        >
                            <span className={styles.playerCheck}>{selected.includes(p.uid) ? '✓' : ''}</span>
                            <span className={styles.playerName}>{p.companyName}</span>
                        </div>
                    ))}
                    {allPlayers.filter(p => p.uid !== myUid).length === 0 && (
                        <div className={styles.emptyGroups}>Brak innych graczy.</div>
                    )}
                </div>

                <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={onClose}>Anuluj</button>
                    <button className={styles.createBtn} onClick={handleCreate} disabled={!name.trim()}>Utwórz</button>
                </div>
            </div>
        </div>
    )
}

function GroupSettings({ group, allPlayers, myUid, onAddMember, onRemoveMember, onClose }) {
    const [adding, setAdding] = useState(false)
    const nonMembers = allPlayers.filter(p => p.uid !== myUid && !group.members?.includes(p.uid))

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Ustawienia: {group.name}</h3>

                <label className={styles.modalLabel}>Członkowie ({group.members?.length || 0})</label>
                <div className={styles.playerList}>
                    {(group.memberNames || []).map((name, i) => {
                        const uid = group.members?.[i]
                        const isMe = uid === myUid
                        const isOwner = uid === group.createdBy
                        return (
                            <div key={uid} className={styles.playerItem} style={{ justifyContent: 'space-between' }}>
                                <span className={styles.playerName}>
                                    {name} {isOwner ? '👑' : ''} {isMe ? '(Ty)' : ''}
                                </span>
                                {!isMe && !isOwner && myUid === group.createdBy && (
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => onRemoveMember(uid)}
                                    >Usuń</button>
                                )}
                            </div>
                        )
                    })}
                </div>

                {myUid === group.createdBy && nonMembers.length > 0 && (
                    <>
                        <button className={styles.addMemberToggle} onClick={() => setAdding(v => !v)}>
                            {adding ? '▲ Ukryj' : '＋ Dodaj gracza'}
                        </button>
                        {adding && (
                            <div className={styles.playerList}>
                                {nonMembers.map(p => (
                                    <div
                                        key={p.uid}
                                        className={styles.playerItem}
                                        onClick={() => { onAddMember(p.uid, p.companyName); setAdding(false) }}
                                    >
                                        <span className={styles.playerCheck}>＋</span>
                                        <span className={styles.playerName}>{p.companyName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <div className={styles.modalActions}>
                    <button className={styles.createBtn} onClick={onClose}>Zamknij</button>
                </div>
            </div>
        </div>
    )
}

// ── main component ──────────────────────────────────────────────────────────

export default function Chat() {
    const { playerDoc } = useGame()
    const myUid = auth.currentUser?.uid
    const myName = playerDoc?.companyName || 'Nieznana Firma'

    const {
        groups, allPlayers,
        activeGroupId, setActiveGroupId,
        messages,
        sendMessage,
        createGroup,
        addMember, removeMember,
        markRead,
    } = useChat(myUid)

    const [text, setText] = useState('')
    const [showNewGroup, setShowNewGroup] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (activeGroupId) markRead(activeGroupId)
    }, [activeGroupId, messages.length])

    const handleSend = () => {
        const t = text.trim()
        if (!t || !activeGroupId) return
        sendMessage(activeGroupId, t, myName)
        setText('')
        inputRef.current?.focus()
    }

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleCreate = (name, memberUids) => {
        createGroup(name, memberUids, myName)
        setShowNewGroup(false)
    }

    return (
        <div className={styles.container}>
            <GroupList
                groups={groups}
                activeId={activeGroupId}
                onSelect={setActiveGroupId}
                onNew={() => setShowNewGroup(true)}
                myUid={myUid}
            />

            <div className={styles.chatArea}>
                {activeGroup ? (
                    <>
                        <div className={styles.chatHeader}>
                            <div>
                                <div className={styles.chatGroupName}>{activeGroup.name}</div>
                                <div className={styles.chatGroupMeta}>{activeGroup.members?.length || 0} uczestników</div>
                            </div>
                            <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} title="Ustawienia grupy">⚙</button>
                        </div>

                        <MessageList messages={messages} myUid={myUid} messagesEndRef={messagesEndRef} />

                        <div className={styles.inputArea}>
                            <textarea
                                ref={inputRef}
                                className={styles.input}
                                value={text}
                                onChange={e => setText(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Napisz wiadomość… (Enter = wyślij)"
                                rows={2}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={handleSend}
                                disabled={!text.trim()}
                            >Wyślij</button>
                        </div>
                    </>
                ) : (
                    <div className={styles.noGroup}>
                        <div className={styles.noGroupIcon}>💬</div>
                        <div>Wybierz rozmowę z listy lub utwórz nową.</div>
                    </div>
                )}
            </div>

            {showNewGroup && (
                <NewGroupModal
                    allPlayers={allPlayers}
                    myUid={myUid}
                    onCreate={handleCreate}
                    onClose={() => setShowNewGroup(false)}
                />
            )}

            {showSettings && activeGroup && (
                <GroupSettings
                    group={activeGroup}
                    allPlayers={allPlayers}
                    myUid={myUid}
                    onAddMember={(uid, name) => addMember(activeGroupId, uid, name)}
                    onRemoveMember={(uid) => removeMember(activeGroupId, uid)}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    )
}
