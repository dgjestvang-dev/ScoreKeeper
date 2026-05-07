let selectedTeamId = null;

export function setSelectedTeam(teamId) {
    selectedTeamId = teamId;
}

export function getSelectedTeam() {
    return selectedTeamId;
}