let selectedTeamId = null;

export function setSelectedTeam(teamId) {
    selectedTeamId = teamId;
}

export function getSelectedTeam() {
    return selectedTeamId;
}

export function clearSelectedTeam() {
    selectedTeamId = null;
}
