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

  getContext: function(trello) {
    return Promise.all([
      trello.member('id'),
      trello.organization('id')
    ]);
  },

  getSyncData: function(trello, member, team) {
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
  },

  createCards: function(list, cardsToCreate) {
    return Promise.all(cardsToCreate.map(function(card) {
      return new Promise(function(resolve, reject) {
        Trello.post('/cards',
          { 
            idList: list.id, 
            name: card.name,
            desc: "Created from " + card.url
          },
          resolve, 
          reject
        );
      });
    }));
  },

  storeSyncedIds: function(trello, newCards, cardsToCreate) {
    return Promise.all(newCards.map(function(card, c) {
      return trello.set(card.id, 'shared', 'teamview_syncedId', cardsToCreate[c].id);
    }));
  },

  doSync: function(trello) {
    var cardsToCreate = null;
    return TeamView.getContext(trello)
    .then(function(values) {
      var member = values[0],
          team = values[1];
      return TeamView.getSyncData(trello, member, team);
    })
    .then(function (values) {
      var cards = values[0],
          boards = values[1],
          list = values[2];
      var boardIds = boards.map(function(b) { return b.id; });
      cardsToCreate = cards.filter(function(c) { return boardIds.includes(c.idBoard); });
      return TeamView.createCards(list, cardsToCreate);
    })
    .then(function(newCards) {
      return TeamView.storeSyncedIds(trello, newCards, cardsToCreate);
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
