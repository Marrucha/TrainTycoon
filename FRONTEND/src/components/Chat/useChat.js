import { useState, useEffect, useRef } from 'react'
import {
    collection, doc, onSnapshot, addDoc, updateDoc, setDoc,
    serverTimestamp, query, orderBy, limit, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'

export const GLOBAL_GROUPS = [
    { id: 'global-pomoc',     name: '📋 Pomoc w grze' },
    { id: 'global-oszustwo',  name: '🚨 Zgłoś oszustwo lub zachowania niezgodne z regulaminem' },
    { id: 'global-blad',      name: '🐛 Zgłoś błąd lub pomysł na rozwój gry' },
    { id: 'global-gielda',    name: '💹 Giełda slotów' },
]

export function useChat(myUid) {
    const [groups, setGroups] = useState([])
    const [allPlayers, setAllPlayers] = useState([])
    const [activeGroupId, setActiveGroupId] = useState(null)
    const [messages, setMessages] = useState([])
    const unsubMsgs = useRef(null)

    // Seed global groups (idempotent — merge: true won't overwrite existing data)
    useEffect(() => {
        if (!myUid) return
        GLOBAL_GROUPS.forEach(g => {
            setDoc(doc(db, 'chatGroups', g.id), {
                name: g.name,
                isGlobal: true,
                members: [],
                memberNames: [],
                createdBy: 'system',
            }, { merge: true })
        })
    }, [myUid])

    // Load all players once (for group creation)
    useEffect(() => {
        if (!myUid) return
        getDocs(collection(db, 'players')).then(snap => {
            setAllPlayers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
        })
    }, [myUid])

    // Listen to all chatGroups — show global ones + groups where user is member
    useEffect(() => {
        if (!myUid) return
        const unsub = onSnapshot(collection(db, 'chatGroups'), snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const visible = all.filter(g => g.isGlobal || g.members?.includes(myUid))

            // Global groups first (in defined order), then private by lastMessageAt desc
            const globalOrder = GLOBAL_GROUPS.map(g => g.id)
            visible.sort((a, b) => {
                const ai = globalOrder.indexOf(a.id)
                const bi = globalOrder.indexOf(b.id)
                if (ai !== -1 && bi !== -1) return ai - bi   // both global: preserve order
                if (ai !== -1) return -1                      // a global, b private
                if (bi !== -1) return 1                       // b global, a private
                const ta = a.lastMessageAt?.toMillis?.() ?? 0
                const tb = b.lastMessageAt?.toMillis?.() ?? 0
                return tb - ta
            })
            setGroups(visible)
        })
        return unsub
    }, [myUid])

    // Listen to messages for active group
    useEffect(() => {
        if (unsubMsgs.current) { unsubMsgs.current(); unsubMsgs.current = null }
        if (!activeGroupId) { setMessages([]); return }

        const q = query(
            collection(db, `chatGroups/${activeGroupId}/messages`),
            orderBy('createdAt', 'asc'),
            limit(200),
        )
        unsubMsgs.current = onSnapshot(q, snap => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        })
        return () => { if (unsubMsgs.current) unsubMsgs.current() }
    }, [activeGroupId])

    const sendMessage = async (groupId, text, authorName) => {
        if (!text || !groupId || !myUid) return
        await addDoc(collection(db, `chatGroups/${groupId}/messages`), {
            text, authorUid: myUid, authorName, createdAt: serverTimestamp(),
        })
        const groupRef = doc(db, 'chatGroups', groupId)
        const snap = await getDoc(groupRef)
        const data = snap.data() || {}

        // Global groups: no per-member unread (no members list), just timestamp
        if (data.isGlobal) {
            await updateDoc(groupRef, { lastMessageAt: serverTimestamp() })
            return
        }
        const members = data.members || []
        const unreadUpdate = {}
        members.forEach(uid => {
            if (uid !== myUid) unreadUpdate[`unread.${uid}`] = (data.unread?.[uid] || 0) + 1
        })
        await updateDoc(groupRef, { ...unreadUpdate, lastMessageAt: serverTimestamp() })
    }

    const createGroup = async (name, memberUids, myName) => {
        if (!name || !myUid) return
        const allMembers = [myUid, ...memberUids]
        const nameMap = { [myUid]: myName }
        await Promise.all(memberUids.map(async uid => {
            const s = await getDoc(doc(db, 'players', uid))
            nameMap[uid] = s.data()?.companyName || uid
        }))
        const memberNames = allMembers.map(uid => nameMap[uid] || uid)
        await addDoc(collection(db, 'chatGroups'), {
            name,
            members: allMembers,
            memberNames,
            createdBy: myUid,
            unread: {},
            lastMessageAt: serverTimestamp(),
        })
    }

    const addMember = async (groupId, uid, name) => {
        const groupRef = doc(db, 'chatGroups', groupId)
        const snap = await getDoc(groupRef)
        const data = snap.data() || {}
        await updateDoc(groupRef, {
            members: [...(data.members || []), uid],
            memberNames: [...(data.memberNames || []), name],
        })
    }

    const removeMember = async (groupId, uid) => {
        const groupRef = doc(db, 'chatGroups', groupId)
        const snap = await getDoc(groupRef)
        const data = snap.data() || {}
        const idx = (data.members || []).indexOf(uid)
        await updateDoc(groupRef, {
            members: (data.members || []).filter(u => u !== uid),
            memberNames: (data.memberNames || []).filter((_, i) => i !== idx),
        })
    }

    const leaveGroup = async (groupId) => {
        await removeMember(groupId, myUid)
        setActiveGroupId(null)
    }

    const markRead = async (groupId) => {
        if (!myUid || !groupId) return
        const groupRef = doc(db, 'chatGroups', groupId)
        await updateDoc(groupRef, { [`unread.${myUid}`]: 0 }).catch(() => {})
    }

    return {
        groups, allPlayers,
        activeGroupId, setActiveGroupId,
        messages,
        sendMessage, createGroup, addMember, removeMember, leaveGroup, markRead,
    }
}
