import os

def patch_composer():
    path = 'c:/Users/Budy3/.gemini/antigravity/scratch/train-manager/FRONTEND/src/components/FleetMenu/TrainComposer.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    c = c.replace('const { trains, trainsSets, routes } = useGame()', 'const { trains, trainsSets, routes, playerDoc, gameDate } = useGame()')
    
    # Insert variables
    c = c.replace('const isEditing = !!editTrainSet', 'const isEditing = !!editTrainSet\n\n    const lastDispatch = playerDoc?.lastTrainDispatchGameTime || 0\n    const timeSinceDispatch = gameDate.getTime() - lastDispatch\n    const oneMonthMs = 30 * 24 * 60 * 60 * 1000\n    const canCreate = isEditing || timeSinceDispatch >= oneMonthMs\n    const daysToWait = Math.ceil((oneMonthMs - timeSinceDispatch) / (24 * 60 * 60 * 1000))')

    # Handle save alert
    c = c.replace("if (composition.length === 0) return alert('Wklej najpierw chociaż jedną maszynę na planszę!')", "if (composition.length === 0) return alert('Wklej najpierw chociaż jedną maszynę na planszę!')\n        if (!canCreate) return alert(`Musisz odczekać jeszcze ${daysToWait} wirtualnych dni, aby stworzyć nowy pociąg!`)")

    # Update playerDoc
    c = c.replace("""totalCostPerKm: maxCostPerKm,
                })
            }
            onCancel()""", """totalCostPerKm: maxCostPerKm,
                })
                await updateDoc(doc(db, `players/${auth.currentUser.uid}`), {
                    lastTrainDispatchGameTime: gameDate.getTime()
                })
            }
            onCancel()""")

    # Wrap the button
    c = c.replace('disabled={saving || speedWarning?.block}', 'disabled={saving || speedWarning?.block || !canCreate}')

    # Add alert box
    c = c.replace("""                    <div className={styles.statsBar}>
                        <div>Prędkość składu: <strong>{compositionSpeed} km/h</strong></div>
                        <div>Konserwacja: <strong>{maxCostPerKm} PLN/km</strong></div>
                        <div>Pojemność SUMA: <strong>{totalSeats} os.</strong></div>
                    </div>""", """                    <div className={styles.statsBar}>
                        <div>Prędkość składu: <strong>{compositionSpeed} km/h</strong></div>
                        <div>Konserwacja: <strong>{maxCostPerKm} PLN/km</strong></div>
                        <div>Pojemność SUMA: <strong>{totalSeats} os.</strong></div>
                    </div>
                    {!canCreate && (
                        <div style={{
                           margin: '6px 0', padding: '8px 10px', borderRadius: 6,
                           background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c',
                           fontSize: 11, color: '#e74c3c'
                        }}>
                            Tworzenie nowych pociągów zostało ograniczone do 1 na wirtualny miesiąc gry. Poczekaj jeszcze <strong>{daysToWait} dni</strong>.
                        </div>
                    )}""")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

patch_composer()
print("TrainComposer patched!")
