/* Magic Mirror
 * Module: MMM-PGA
 *
 * By mcl8on
 *
 */
const NodeHelper = require('node_helper');
var ESPN = require('./ESPN.js');
const OWGR = require('./OWGR.js');
const FEDEXCUP = require('./FEDEXCUP.js');
const express = require("express");

module.exports = NodeHelper.create({
    requiresVersion: '2.20.0', 

    start: function() {
        console.log("Starting node_helper for: " + this.name); 
        this.expressApp.use(express.urlencoded({ extended: true }));
		this.expressApp.post('/MMM-PGA-UpdateFavs', this._onUpdateFavs.bind(this));
    },

    _onUpdateFavs: function(req, res) {
        console.log("MMM-PGA: Update favorites");
        this.sendSocketNotification("UPDATE_FAVORITES"); 
		res.sendStatus(200);
	},

    // Core function of franewor that schedules the Update
    scheduleUpdate: function () {

        //schedule the updates for Subsequent Loads
        var self =this; 

        var num = this.config.numTournaments;

        setInterval(() => {
            self.getPGAData(num);
        }, self.config.updateInterval);
        
    },

     //Schedule the Ranking Updates. This is a much longer intervl since the data only changes weekly
     scheduleRankingUpdate: function () {
        //schedule the updates for Subsequent Loads
        
        var self =this; 
        setInterval(() => {
            self.getRankingData(self.config.maxNumRankings);
        }, self.config.rankingsUpdateInterval);
        
    },

    getPGAData: function(numTournaments){

        var self = this;

        ESPN.getTournamentData(function (tournament){
            self.sendSocketNotification("PGA_RESULT",tournament);});
        
        ESPN.getTournaments(numTournaments, function (tournaments){
            self.sendSocketNotification("PGA_TOURNAMENT_LIST",tournaments);});
    },

    getRankingData: function(maxNumRankings, rapidAPIKey){
        var self = this;

        OWGR.getOWGRData(maxNumRankings, rapidAPIKey, function(owgrRanking){
            self.sendSocketNotification("OWGR_RANKING",owgrRanking);});

        FEDEXCUP.getFedExCupData(maxNumRankings, rapidAPIKey, function(fcRanking){
            self.sendSocketNotification("FEDEXCUP_RANKING",fcRanking);});

    },

    socketNotificationReceived: function(notification, payload) {

        var self = this;

        if (notification === 'MMM-PGA-CONFIG') {
            console.log ("MMM-PGA config received");
            this.config = payload;
            if (this.started !== true) {
              this.started = true;
              this.scheduleUpdate(); 
              this.scheduleRankingUpdate();
        
            }

            //Load Data to begin with so we dont have to wait for next server load
            //Each client will make a call at startupß
            this.getPGAData(this.config.numTournaments);
            this.getRankingData(this.config.maxNumRankings, this.config.rapidAPIKey);
            
        }
        
            
    }
});
