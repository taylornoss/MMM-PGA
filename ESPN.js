
const moment = require('moment');
const LOG = require('logger');

module.exports = {

    url: "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga",
    //url: "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=401219795",
    urlTournamentList: "https://www.espn.com/golf/schedule/_/tour/pga?_xhr=pageContent&offset=-04%3A00",

    async getTournamentData(callback) {

        LOG.log("ESPN MMM-PGA retrieving Tournament Data");

        const response = await fetch(this.url, {
            method: 'get'
        })

        const body = await response.json();

        //sort events by purse
        var ESPNObj = body.events.sort((e1, e2) => (e1.purse < e2.purse) ? 1 : (e1.purse < e2.purse) ? -1 : 0);

        // Filter out any canceled events
        var events = ESPNObj.filter(event => event.status.type.name !== 'STATUS_CANCELED');
        LOG.log("ESPN MMM-PGA parsing Tournament Data for "+events.length+" tournaments.");
        let tournaments = [];
        events.forEach((event) => {
            let tournament = {};

            //Tournament Details
            tournament.name = event.shortName;
            tournament.date = this.getEventDate(event.date, event.endDate);
            tournament.location = this.getEventLocation(event);
            tournament.statusCode = event.status.type.name;
            tournament.status = event.competitions[0].status ? event.competitions[0].status.type.detail : "";
            tournament.purse = event.displayPurse;
            tournament.defendingChamp = event.defendingChampion ? event.defendingChampion.athlete.displayName : ""
            tournament.currentRound = this.getCurrentRound(event);
            tournament.playoff = false;

            //Load the Players for the tournament

            tournament.players = [];

            if (tournament.statusCode != "STATUS_SCHEDULED") {

                var espnPlayers = event.competitions[0].competitors;

                for (var i in espnPlayers) {

                    var espnPlayer = espnPlayers[i];
                    if (espnPlayer.status.playoff)
                        tournament.playoff = true;

                    tournament.players.push({
                        "name": espnPlayer.athlete.displayName,
                        "position": espnPlayer.status.position.displayName,
                        "posId": parseInt(espnPlayer.status.position.id),
                        "flagHref": espnPlayer.athlete.flag.href,
                        "score": espnPlayer.statistics[0].displayValue,
                        "thru": this.getPlayerThru(espnPlayer),
                        "roundScore": this.getRoundScore(espnPlayer, tournament.currentRound),
                        "id": espnPlayer.athlete.id,
                        "sortOrder": espnPlayer.sortOrder,
                        "playoff": espnPlayer.status.playoff
                    });
                }
                tournaments.push(tournament);
            }
        });
        LOG.log("ESPN MMM-PGA parsing Tournament Data Complete. "+tournaments.length+" active tournaments ongoing.");
        //Function to send SocketNotification with the Tournament Data
        callback(tournaments);
    },

    async getTournaments(numTournaments, callback) {
        var totalTourn = 0

        const response = await fetch(this.urlTournamentList, {
            method: 'get',
        })

        const body = await response.json();
        
        var ESPNObj = body.events;

        //Only look at future Tournaments
        ESPNObj = ESPNObj.filter(tournament => tournament.status == "pre");

        if (numTournaments > ESPNObj.length) {
            totalTourn = ESPNObj.length
        } else {
            totalTourn = numTournaments
        }

        tournaments = [];

        for (i = 0; i < totalTourn; i++) {
            var tournament = ESPNObj[i];
            var tourName = tournament.name ? tournament.name : ""
                var strDate = tournament.startDate ? tournament.startDate : ""
                var nDate = tournament.endDate ? tournament.endDate : ""
                var venue = tournament.locations[0] ? tournament.locations[0].venue.fullName : ""
                tournaments.push({
                    "name": tourName, //tournament.name,
                    "date": this.getEventDate(strDate, nDate), //tournament.startDate,tournament.endDate),
                    "location": venue, //tournament.locations[0].venue.fullName,
                    "purse": this.setUndefStr(tournament.purse, "TBD"),
                    "defendingChamp": this.setUndefStr(tournament.athlete.name)

                });
        }

        callback(tournaments);
    },

    getCurrentRound: function (event) {

        //logic to handle playoffs For now we only showing information pertaininhg to rounds in regulation

        currentRound = event.competitions[0].status ? event.competitions[0].status.period : "";
        totalRounds = event.tournament.numberOfRounds;
        return (currentRound <= totalRounds) ? currentRound : totalRounds;

    },

    getEventDate: function (start, end) {
        var startDate = moment(start, "YYYY-MM-DD HH:mm Z").local().format("MMM D");
        var endDate = moment(end, "YYYY-MM-DD HH:mm Z").local().format("MMM D");
        return startDate + " - " + endDate;

    },

    getEventLocation: function (event) {

        var course = event.courses[0];

        var city = this.setUndefStr(course.address.city);
        var state = this.setUndefStr(course.address.state);
        var appendstring = ", ";

        if (city.length == 0 || state.length == 0) {
            appendstring = "";
        }

        return course.name + " " + city + appendstring + state;

    },

    getRoundScore: function (player, round) {

        var roundScore = "-";
        var linescore = player.linescores[round - 1];

        if (!(typeof linescore == 'undefined' || linescore == null)) {
            roundScore = linescore.displayValue;
        }

        return roundScore;
    },

    getPlayerThru: function (player) {

        var displayValue = player.status.displayValue;
        var append = (player.status.startHole == "1") ? "" : "*";

        var teeTime = moment(displayValue, "YYYY-MM-DD HH:mm:ss Z");
        if (typeof displayValue == 'undefined' || displayValue == null) {

            returnValue = player.status.displayThru + append;

        } else if (displayValue == "F") {
            returnValue = displayValue;
        } else if (player.status.thru <= 17 && player.status.thru >= 1) {
            returnValue = displayValue + append;
        } else if (teeTime.isValid()) {
            returnValue = teeTime.local().format("h:mm a") + append;
        } else {
            returnValue = displayValue;
        }

        return returnValue;
    },

    setUndefStr: function (obj, defStr = "") {
        return (typeof obj == "undefined") ? defStr : obj;
    }

};
