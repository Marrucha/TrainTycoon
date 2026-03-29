import os

# 1. TrainComposer.jsx
def patch_composer():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/TrainComposer.jsx'
    with open(path, 'r', encoding='utf-8') as f: c = f.read()

    c = c.replace('const { trains, trainsSets, routes } = useGame()', 'const { trains, trainsSets, routes, gameConstants } = useGame()')

    save_logic = """            if (isEditing) {
                await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, editTrainSet.id), {
                    name: trainName,"""
    
    new_save_logic = """            const next3AM = new Date()
            next3AM.setHours(3, 0, 0, 0)
            if (next3AM.getTime() <= Date.now()) {
                next3AM.setDate(next3AM.getDate() + 1)
            }
            let dispatchMs = null
            if (gameConstants?.REAL_START_TIME_MS) {
                dispatchMs = gameConstants.GAME_START_TIME_MS + (next3AM.getTime() - gameConstants.REAL_START_TIME_MS) * (gameConstants.TIME_MULTIPLIER || 30)
            } else {
                dispatchMs = next3AM.getTime()
            }

            if (isEditing) {
                await updateDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, editTrainSet.id), {
                    name: trainName,"""

    c = c.replace(save_logic, new_save_logic)

    # Insert dispatchDate into new trainset
    set_logic = """                await setDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, setId), {
                    id: setId,
                    name: trainName,"""
    new_set_logic = """                await setDoc(doc(db, `players/${auth.currentUser.uid}/trainSet`, setId), {
                    id: setId,
                    name: trainName,
                    dispatchDate: dispatchMs,"""
    
    c = c.replace(set_logic, new_set_logic)

    with open(path, 'w', encoding='utf-8') as f: f.write(c)

# 2. FleetCompositions.jsx
def patch_fleet():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/FleetCompositions.jsx'
    with open(path, 'r', encoding='utf-8') as f: c = f.read()

    # Locate rendering loop
    find_str = """        {filtered.map(ts => {
          const tType = getComposType(ts)"""
    
    replace_str = """        {filtered.map(ts => {
          const tType = getComposType(ts)
          const isWaiting = ts.dispatchDate && ts.dispatchDate > gameDate.getTime()"""

    c = c.replace(find_str, replace_str)

    # Add tag inside render
    tag_str = """                </h3>
                <span className={styles.typeBadge}>"""
    new_tag_str = """                </h3>
                {isWaiting && (
                    <span style={{ fontSize: 11, background: 'rgba(231,76,60,0.2)', color: '#e74c3c', padding: '3px 8px', borderRadius: 4, marginLeft: 10, fontWeight: 500 }}>
                        Zaplanowany: Start 1-szego
                    </span>
                )}
                <span className={styles.typeBadge}>"""
    c = c.replace(tag_str, new_tag_str)

    with open(path, 'w', encoding='utf-8') as f: f.write(c)

# 3. staff.py
def patch_staff():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/staff.py'
    with open(path, 'r', encoding='utf-8') as f: c = f.read()

    c = c.replace('if today.day != 1:\n        return', '')
    
    with open(path, 'w', encoding='utf-8') as f: f.write(c)

# 4. boarding_sim.py
def patch_boarding():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/functions/boarding_sim.py'
    with open(path, 'r', encoding='utf-8') as f: c = f.read()

    find_boarding = "if ts.get('speedMismatchBlock'):\n                continue"
    replace_boarding = """if ts.get('speedMismatchBlock'):
                continue

            dispatch_ms = ts.get('dispatchDate')
            if dispatch_ms:
                # We can calculate virt_now_ms for this minute based on m_str relative to virt_start_ms or just real_now_ms.
                # Since batching runs every 1 minute and spans roughly 30 minutes, 
                # we can approximate using the current real_now_ms + virtual calculations.
                virt_now_ms = game_start_ms + (int(time.time() * 1000) - real_start_ms) * multiplier
                if virt_now_ms < dispatch_ms:
                    continue"""
    
    c = c.replace(find_boarding, replace_boarding)

    with open(path, 'w', encoding='utf-8') as f: f.write(c)

patch_composer()
patch_fleet()
patch_staff()
patch_boarding()
print("All dispatch features patched! Composer, Fleet, Staff, and Boarding ready.")
