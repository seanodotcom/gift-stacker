// Leaderboard Logic

const Leaderboard = {
    minHighScore: 0,
    // Submit a score to Firestore
    submitScore: function (name, score) {
        if (!name || !score) {
            console.error("Invalid score submission data");
            return;
        }

        // Simple validation
        const safeName = name.substring(0, 12).replace(/[^a-zA-Z0-9 ]/g, "");

        db.collection("scores").add({
            name: safeName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
            .then((docRef) => {
                console.log("Score submitted with ID: ", docRef.id);
                // Refresh leaderboard and highlight the new score
                this.fetchLeaderboard(10, docRef.id);
            })
            .catch((error) => {
                console.error("Error adding score: ", error);
            });
    },

    // Fetch top scores
    fetchLeaderboard: function (limit = 10, highlightId = null) {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '<li class="loading">Loading...</li>';

        if (typeof db === 'undefined') {
            console.error("FATAL: 'db' is undefined. Firebase initialization failed.");
            leaderboardList.innerHTML = '<li class="error">Connection Error: Refresh or Check Config</li>';
            return;
        }

        db.collection("scores")
            .orderBy("score", "desc")
            .limit(limit)
            .get()
            .then((querySnapshot) => {
                leaderboardList.innerHTML = '';
                let rank = 1;
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const li = document.createElement('li');

                    // Rank Styling
                    let rankClass = 'rank-other';
                    if (rank === 1) rankClass = 'rank-gold';
                    else if (rank === 2) rankClass = 'rank-silver';
                    else if (rank === 3) rankClass = 'rank-bronze';

                    // Highlight check
                    if (highlightId) {
                        if (doc.id === highlightId) {
                            console.log("MATCH FOUND for Highlight! Applying class to:", data.name);
                            li.classList.add('highlight-score');
                        }
                    }

                    li.innerHTML = `
                        <span class="rank ${rankClass}">#${rank}</span>
                        <span class="name">${data.name}</span>
                        <span class="score">${data.score}</span>
                    `;
                    leaderboardList.appendChild(li);
                    rank++;
                });

                if (querySnapshot.empty) {
                    leaderboardList.innerHTML = '<li class="empty">No scores yet!</li>';
                    this.minHighScore = 0;
                } else {
                    // Update minHighScore for "New High Score" check
                    // If we have fewer than 10 scores, the effective min to beat is 0.
                    // If we have 10, it's the last one.
                    if (querySnapshot.size < 10) {
                        this.minHighScore = 0;
                    } else {
                        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                        this.minHighScore = lastDoc.data().score;
                    }
                    console.log("Leaderboard updated. Min High Score to beat:", this.minHighScore);
                }
            })
            .catch((error) => {
                console.error("Error getting leaderboard: ", error);
                leaderboardList.innerHTML = '<li class="error">Error loading scores.</li>';
            });
    }
};

// Expose to window
window.Leaderboard = Leaderboard;
