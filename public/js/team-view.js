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
    return trello.get('member', 'shared', 'teamview_list')
    .then(function(list) {
      return new Promise(function(resolve, reject) {
        console.log('Creating card...');
        Trello.post('/cards', 
          {
            idList: list.id,
            name: 'Test card'
          },
          resolve,
          reject
        );
      });
    })
    .then(function (card) {
      console.log(card);
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
