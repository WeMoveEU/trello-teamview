/* global TrelloPowerUp */

var WHITE_ICON = 'https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-white.svg';

function pickYourList(trello, opts) {
  return trello.lists('id', 'name').then(function(lists) {
    var pickables = lists.map(function(item) {
      return {
        text: item.name,
        callback: function(trello, opts) {
          console.log("You picked " + item.id);
          trello.set('member', 'shared', 'teamview_list', item);
          return trello.closePopup();
        }
      };
    });

    return trello.popup({
      title: 'Pick a list',
      items: pickables
    });
  }).catch(function(error) {
    console.error(error);
  });
}

function syncView(trello, opts) {
  console.log("Syncing...");
}

function onBoardButtonClick(trello, opts) {
  return trello.get('member', 'shared', 'teamview_list').then(function(list) {
    var buttonText = 'Set your list';
    if (list) {
      buttonText = 'Your list: ' + list.name;
    }
    return trello.popup({
      title: 'TeamView settings',
      items: [{
        text: buttonText,
        callback: pickYourList
      }, {
        text: 'Sync',
        callback: syncView
      }]
    });
  });
}

TrelloPowerUp.initialize({
  'board-buttons': function (trello, opts) {
    return [{
      icon: WHITE_ICON,
      text: 'TeamView',
      callback: onBoardButtonClick
    }];
  }
});

