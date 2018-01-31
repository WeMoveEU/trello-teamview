var Promise = TrelloPowerUp.Promise;

window.TeamView = {

  listFilters: ['mocha', 'done'],

  context: null,

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
    if (TeamView.context) {
      return Promise.resolve(TeamView.context);
    }
    else {
      return Promise.all([
        trello.member('id'),
        trello.organization('id'),
        trello.get('board', 'shared', 'teamview_config')
      ])
      .then(function(values) {
        TeamView.context = {
          member: values[0],
          team: values[1],
          config: values[2]
        };
        return Promise.resolve(TeamView.context);
      });
    }
  },

  getSyncData: function(memberId, team) {
    var memberCards = new Promise(function(resolve, reject) {
      Trello.get('/members/' + memberId + '/cards', resolve, reject);
    });
    if (TeamView.boards) {
      var teamBoards = Promise.resolve(TeamView.boards);
    } else {
      var teamBoards = new Promise(function(resolve, reject) {
        Trello.get('/organizations/' + team.id + '/boards', resolve, reject);
      })
      .then(function(boards) {
        return Promise.all(boards.map(function(board) {
          return new Promise(function(resolve, reject) {
            Trello.get('/boards/' + board.id + '/lists',
              { fields: 'id,name' },
              function(lists) {
                board.lists = lists;
                resolve(board);
              },
              reject
            );
          });
        }));
      })
      .then(function(boards) {
        TeamView.boards = boards;
        return Promise.resolve(boards);
      });
    }
    return Promise.all([
      memberCards,
      teamBoards
    ]);
  },

  getCurrentView: function(trello, list) {
    return trello.lists('all')
    .then(function(lists) {
      var existingCards = lists.find(function(l) { return l.id == list.id}).cards;
      var result = { none: [] };
      return Promise.all(existingCards.map(function(card) {
        return trello.get(card.id, 'shared', 'teamview_syncedId');
      }))
      .then(function(syncedIds) {
        syncedIds.forEach(function(id, i) {
          if (id) {
            result[id] = existingCards[i];
          } else {
            result['none'].push(existingCards[i]);
          }
        });
        return result;
      });
    });
  },

  isSyncable: function(card, boardIds, lists) {
    return boardIds.includes(card.idBoard) && !TeamView.listFilters.includes(lists[card.idList].name.toLowerCase());
  },

  splitCards: function(currentView, memberCards, boards) {
    var syncedIds = Object.keys(currentView);
    var cardIds = memberCards.map(function(c) { return c.id; });
    var boardIds = boards.map(function(b) { return b.id; });
    var lists = [];
    boards.forEach(function(board) {
      board.lists.forEach(function(list) {
        lists[list.id] = list;
      });
    });
    
    var result = {
      missing: [],
      changed: [],
      added: memberCards.filter(function(c) { 
        return TeamView.isSyncable(c, boardIds, lists) && !syncedIds.includes(c.id);
      })
    };

    syncedIds.forEach(function(id) {
      if (id !== 'none') {
        var c = cardIds.indexOf(id)
        if (c < 0 || !TeamView.isSyncable(memberCards[c], boardIds, lists)) {
          result.missing.push(currentView[id]);
        }
        else if (currentView[id].name != memberCards[c].name) {
          result.changed.push([currentView[id], memberCards[c]]);
        }
      }
    });
    
    return result;
  },

  deleteCards: function(cardsToDelete) {
    return Promise.all(cardsToDelete.map(function(card) {
      return new Promise(function(resolve, reject) {
        Trello.delete('/cards/' + card.id, resolve, reject);
      });
    }));
  },

  updateCards: function(cardsToUpdate) {
    return Promise.all(cardsToUpdate.map(function(pair) {
      var old = pair[0],
          recent = pair[1];
      return new Promise(function(resolve, reject) {
        Trello.put('/cards/' + old.id, { name: recent.name }, resolve, reject);
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

  syncMember: function(trello, memberId) {
    return TeamView.getSyncData(memberId, TeamView.context.team)
    .then(function(values) {
      var memberCards = values[0],
          boards = values[1],
          list = TeamView.context.config.memberLists[memberId];
      return TeamView.getCurrentView(trello, list)
      .then(function(currentView) {
        var cardsByStatus = TeamView.splitCards(currentView, memberCards, boards);
        return TeamView.deleteCards(cardsByStatus.missing)
        .then(function() {
          return TeamView.updateCards(cardsByStatus.changed);
        })
        .then(function() {
          return TeamView.createCards(list, cardsByStatus.added);
        })
        .then(function(newCards) {
          return new Promise(function(resolve, reject) {
            console.log("Waiting a bit before storing metadata...");
            setTimeout(function(){ resolve(newCards); }, 500);
          });
        })
        .then(function(newCards) {
          return TeamView.storeSyncedIds(trello, newCards, cardsByStatus.added);
        });
      });
    });
  },

  doSync: function(trello) {
    return TeamView.getContext(trello)
    .then(function(context) {
      //We use the below mecanism instead of Promise.all so that the promises are resolved sequentially
      //This is to avoid any race on retrieving and caching the team boards
      var members = Object.getOwnPropertyNames(context.config.memberLists);
      members[0] = TeamView.syncMember(trello, members[0]);
      return Promise.reduce(members, function(_, memberId) {
        return TeamView.syncMember(trello, memberId);
      });
    })
    .catch(function(e) {
      console.error(e.message ? e.message : e);
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
