var Promise = TrelloPowerUp.Promise;

window.TeamView = {

  checkAuth: function() {
    return new Promise(function(resolve, reject) {
      Trello.authorize({
        name: 'TeamView',
        scope: { read: true, write: true },
        expiration: 'never',
        interactive: false,
        success: resolve,
        error: reject
      }); 
    });
  },

  authFlow: function(trello) {
    return trello.popup({
      title: 'Authorize TeamView',
      url: './authorize.html',
      height: 180,
    });
  },

  doSync: function(trello) {
    var memberId = null;
    return Promise.all([
      trello.member('id'),
      trello.organization('id')
    ])
    .then(function(values) {
      var member = values[0],
          team = values[1];
      var memberCards = new Promise(function(resolve, reject) {
        Trello.get('/members/' + member.id + '/cards', resolve, reject);
      });
      var teamBoards = new Promise(function(resolve, reject) {
        Trello.get('/organizations/' + team.id + '/boards', resolve, reject);
      });
      return Promise.all([
        memberCards,
        teamBoards,
        trello.get('member', 'shared', 'teamview_list')
      ]);
    })
    .then(function (values) {
      var cards = values[0],
          boards = values[1],
          list = values[2];
      var boardIds = boards.map(function(b) { return b.id; });
      var teamCards = cards.filter(function(c) { return boardIds.includes(c.idBoard); });
      return Promise.all(teamCards.map(function(card) {
        return new Promise(function(resolve, reject) {
          Trello.post('/cards',
            { idList: list.id, name: card.name },
            resolve, reject
          );
        });
      }));
    })
    .catch(function() {
      console.error(arguments);
    });
  },

  syncView: function (trello, opts) {
    return TeamView.checkAuth()
    .then(function() {
      return TeamView.doSync(trello);
    })
    .then(function() {
      return trello.closePopup();
    })
    .catch(function() {
      //Non-interactive authorization failed, start authorization flow
      return TeamView.authFlow(trello);
    });
  }

};
