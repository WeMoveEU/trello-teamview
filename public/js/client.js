/* global TrelloPowerUp */

var WHITE_ICON = 'https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-white.svg';

function listPicker(trello, opts) {
  return trello.lists('id', 'name')
  .then(function(lists) {
    var pickables = lists.map(function(item) {
      return {
        text: item.name,
        callback: function(trello, opts) {
          var ctx = TeamView.context;
          ctx.config = ctx.config || { memberLists: {} };
          ctx.config.memberLists[ctx.member.id] = item;
          trello.set('board', 'shared', 'teamview_config', ctx.config);
          return trello.closePopup();
        }
      };
    });

    return trello.popup({
      title: 'Pick a list',
      items: pickables
    });
  })
  .catch(function(error) {
    console.error(error);
  });
}

function onBoardButtonClick(trello, opts) {
  return TeamView.getContext(trello)
  .then(function(context) {
    var buttonText = 'Set your list';
    var list = context.config && context.config.memberLists[context.member.id];
    if (list) {
      buttonText = 'Your list: ' + list.name;
    }
    return trello.popup({
      title: 'TeamView settings',
      items: [{
        text: buttonText,
        callback: listPicker
      }, {
        text: 'Sync',
        callback: TeamView.syncView
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

