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

  getSyncView: function(trello, list) {
    return trello.lists('all')
    .then(function(lists) {
      var existingCards = lists.find(function(l) { return l.id == list.id}).cards;
      var result = {};
      return Promise.all(existingCards.map(function(card) {
        return trello.get(card.id, 'shared', 'teamview_syncedId');
      }))
      .then(function(syncedIds) {
        syncedIds.forEach(function(id, i) {
          result[id] = existingCards[i];
        });
        return result;
      });
    });
  },

  getNewCards: function(syncView, memberCards, boards) {
    var boardIds = boards.map(function(b) { return b.id; });
    var syncedIds = Object.keys(syncView);
    var newCards = memberCards.filter(function(c) { 
      return boardIds.includes(c.idBoard) && !syncedIds.includes(c.id);
    });
    return newCards;
  },

  getStaleCards: function(syncView, memberCards) {
    var cardIds = memberCards.map(function(c) { return c.id; });
    var staleCards = [];
    Object.keys(syncView).forEach(function(id) {
      if (!cardIds.includes(id)) {
        staleCards.push(syncView[id]);
      }
    });
    return staleCards;
  },

  deleteCards: function(cardsToDelete) {
    return Promise.all(cardsToDelete.map(function(card) {
      return new Promise(function(resolve, reject) {
        Trello.delete('/cards/' + card.id, resolve, reject);
      });
    }));
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
    return TeamView.getContext(trello)
    .then(function(values) {
      var member = values[0],
          team = values[1];
      return TeamView.getSyncData(trello, member, team);
    })
    .then(function(values) {
      var memberCards = values[0],
          boards = values[1],
          list = values[2];
      return TeamView.getSyncView(trello, list)
      .then(function(syncView) {
        var cardsToCreate = TeamView.getNewCards(syncView, memberCards, boards);
        var cardsToUnsync = TeamView.getStaleCards(syncView, memberCards);
        return TeamView.deleteCards(cardsToUnsync)
        .then(function() {
          return TeamView.createCards(list, cardsToCreate);
        })
        .then(function(newCards) {
          return TeamView.storeSyncedIds(trello, newCards, cardsToCreate);
        });
      });
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
