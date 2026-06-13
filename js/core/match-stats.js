export function createMatchStats() {
    const stats = {
        home: {
            goals: 0,
            corners: 0,
            shots_total: 0,
            shots_target: 0,
            offside:0,
            yellow_card: 0,
            red_card: 0
        },
        away: {
            goals: 0,
            corners: 0,
            shots_total:0,
            shots_target: 0,
            offside:0,
            yellow_card: 0,
            red_card: 0
        }
    };

    return {
        get(team, stat) {
            return stats[team][stat];
        },

        increment(team, stat) {
            stats[team][stat] += 1;
        },

        decrement(team, stat) {
            if (stats[team][stat] > 0) {
                stats[team][stat] -= 1;
            }
        },

        reset() {
            Object.keys(stats).forEach(team => {
                Object.keys(stats[team]).forEach(stat => {
                    stats[team][stat] = 0;
                });
            });
        }
    };
}
