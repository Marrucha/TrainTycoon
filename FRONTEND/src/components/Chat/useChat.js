import { useState, useEffect, useRef } from 'react'
import {
    collection, doc, onSnapshot, addDoc, updateDoc,
    serverTimestamp, query, orderBy, limit, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'

export function useChat(myUid) {
    const [groups, setGroups] = useState([])
    const [allPlayers, setAllPlayers] = useState([])
    const [activeGroupId, setActiveGroupId] = useState(null)
    const [messages, setMessages] = useState([])
    const unsubMsgs = useRef(null)

    // Load all players once (for group creation)
    useEffect(() => {
        if (!myUid) return
        getDocs(collection(db, 'players')).then(snap => {
            setAllPlayers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
        })
    }, [myUid])

    // Listen to groups where current user is a member
    useEffect(() => {
        if (!myUid) return
        const unsub = onSnapshot(collection(db, 'chatGroups'), snap => {
            const mine = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(g => g.members?.includes(myUid))
                .sort((a, b) => {
                    const ta = a.lastMessageAt?.toMillis?.() ?? 0
                    const tb = b.lastMessageAt?.toMillis?.() ?? 0
                    return tb - ta
                })
            setGroups(mine)
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
        const ref = collection(db, `chatGroups/${groupId}/messages`)
        await addDoc(ref, { text, authorUid: myUid, authorName, createdAt: serverTimestamp() })
        // Increment unread for all OTHER members
        const groupRef = doc(db, 'chatGroups', groupId)
        const snap = await getDoc(groupRef)
        const members = snap.data()?.members || []
        const unreadUpdate = {}
        members.forEach(uid => {
            if (uid !== myUid) unreadUpdate[`unread.${uid}`] = (snap.data()?.unread?.[uid] || 0) + 1
        })
        await updateDoc(groupRef, { ...unreadUpdate, lastMessageAt: serverTimestamp() })
    }

    const createGroup = async (name, memberUids, myName) => {
        if (!name || !myUid) return
        const allMembers = [myUid, ...memberUids]
        // Fetch display names for all members
        const nameMap = {}
        nameMap[myUid] = myName
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
        const members = [...(data.members || []), uid]
        const memberNames = [...(data.memberNames || []), name]
        await updateDoc(groupRef, { members, memberNames })
    }

    const removeMember = async (groupId, uid) => {
        const groupRef = doc(db, 'chatGroups', groupId)
        const snap = await getDoc(groupRef)
        const data = snap.data() || {}
        const idx = (data.members || []).indexOf(uid)
        const members = (data.members || []).filter(u => u !== uid)
        const memberNames = (data.memberNames || []).filter((_, i) => i !== idx)
        await updateDoc(groupRef, { members, memberNames })
    }

    const markRead = async (groupId) => {
        if (!myUid || !groupId) return
        const groupRef = doc(db, 'chatGroups', groupId)
        await updateDoc(groupRef, { [`unread.${myUid}`]: 0 }).catch(() => {})
    }

    const leaveGroup = async (groupId) => {
        await removeMember(groupId, myUid)
        setActiveGroupId(null)
    }

    return {
        groups, allPlayers,
        activeGroupId, setActiveGroupId,
        messages,
        sendMessage, createGroup, addMember, removeMember, leaveGroup, markRead,
    }
}
