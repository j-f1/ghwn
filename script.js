var FormView = Backbone.View.extend({

  template: $('#form-template').html(),

  initialize: function (options) {
    this.router = options.router
    this.render()
  },

  render: function () {
    this.$el.html(this.template)
  },

  events: {
    'submit form': 'submit'
  },

  submit: function (e) {
    e.preventDefault()
    var name = this.$('[name=name]').val()
    this.router.navigate(name, {trigger: true});
  },

  setName: function (name) {
    this.$('[name=name]').val(name)
  }
})

var ListView = Backbone.View.extend({

  template: _.template($('#list-template').html()),

  initialize: function () {
    this.listenTo(this.collection, 'add reset', this.render)
  },

  render: function () {
    this.$el.html(this.template({
      collection: this.collection.toJSON()
    }))
  }

})

var eventURL = function(event) {
  var pl = event.payload
  function url(key) {
    return pl[key].html_url
  }
  if (event.type == 'PullRequestEvent') {
    return url('pull_request')
  } else if (event.type == 'PushEvent') {
    if (pl.size === 1) {
      return 'https://github.com/'+event.repo.name+'/commit/'+pl.head
    }
    return 'https://github.com/'+event.repo.name+'/compare/'+pl.before+'...'+pl.head
  } else if (event.type == 'IssuesEvent') {
    return url('issue')
  } else if (event.type == 'IssueCommentEvent' || event.type == 'CommitCommentEvent') {
    return url('comment')
  } else if (event.type == 'ForkEvent') {
    return url('forkee')
  } else if (event.type == 'FollowEvent') { // **
    return url('target')
  } else if (event.type == 'GollumEvent') { // wiki update
    if (!/^https:\/\/github.com/.exec(pl.pages[0].html_url)) {
      pl.pages[0].html_url = pl.pages[0].html_url.replace(/^\/?/, 'https://github.com/')
    }
    return pl.pages[0].html_url + '/_compare/' + pl.pages[0].sha
  } else if (event.type == 'PublicEvent') {
    return 'https://github.com/'+pl.repository.full_name
  } else if (event.type == 'PullRequestReviewEvent') {
    return url('review')
  } else if (event.type == 'PullRequestReviewCommentEvent') {
    return url('comment')
  } else if (event.type == 'ReleaseEvent') {
    return url('release')
  } else {
    // CreateEvent, DeleteEvent, MemberEvent, OrgBlockEvent,
    // ProjectCardEvent, ProjectColumnEvent, ProjectEvent, WatchEvent,
    // DownloadEvent**, ForkApplyEvent**, GistEvent**,
    // MembershipEvent*, MilestoneEvent*, LabelEvent*,
    // OrganizationEvent*, DeploymentEvent*, DeploymentStatusEvent*,
    // PageBuildEvent*, RepositoryEvent*, StatusEvent*,
    // TeamEvent*, TeamAddEvent*
    // * not in timelines
    // ** no longer created
    return 'https://github.com/'+event.repo.name
  }
}

function plur(n, s) {
  if (n != 1) {
    return s || 's'
  }
  return ''
}
function title(s) {
  // from http://stackoverflow.com/a/196991/5244995
  return s.replace(/_/g, ' ').replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
var eventTitle = function (event) {
  var pl = event.payload
  if (event.type == 'PullRequestEvent' || event.type == 'IssuesEvent') {
    if (pl.action == 'closed' && pl.pull_request && pl.pull_request.merged) {
      pl.action = 'merged'
    }
    return (pl.pull_request ? 'Pull Request' : 'Issue') + ' #' + (pl.number || pl.issue.number) + ' ' + title(pl.action)
  } else if (event.type == 'PushEvent') {
    return pl.size + ' Commit' + plur(pl.size) + ' Pushed to ' + pl.ref.replace(/^refs\/[^\/]+\//, '')
  } else if (event.type == 'IssueCommentEvent') {
    return 'Comment ' + title(pl.action) + ' on ' + (pl.issue.pull_request ? 'Pull Request' : 'Issue') + ' #' + pl.issue.number
  } else if (event.type == 'CommitCommentEvent') {
    return 'Comment Created on commit ' + pl.comment.commit_id.slice(0, 7)
  } else if (event.type == 'ForkEvent') {
    return 'Fork Created by ' + pl.forkee.owner.login
  } else if (event.type == 'FollowEvent') {
    return 'User followed'
  } else if (event.type == 'GollumEvent') {
    return 'Wiki Page “' + pl.pages[0].title + '” ' + title(pl.pages[0].action)
  } else if (event.type == 'PublicEvent') {
    return 'Repo open-sourced :)'
  } else if (event.type == 'PullRequestReviewEvent') {
    return 'Pull Request #' + pl.pull_request.number + ' Reviewed: ' + title(pl.review.state)
  } else if (event.type == 'PullRequestReviewCommentEvent') {
    return 'Pull Request #' + pl.pull_request.number + ' Comment ' + title(pl.action)
  } else if (event.type == 'PullRequestReviewCommentEvent') {
    return 'Release ' + (pl.release.name || pl.release.tag_name) + ' ' + title(pl.action) + (pl.release.draft ? ' [Draft]' : '')
  } else if (event.type == 'CreateEvent') {
    return title(pl.ref_type) + ' ' + (pl.ref || event.repo.name) + ' Created'
  } else if (event.type == 'DeleteEvent') {
    return title(pl.ref_type) + ' ' + pl.ref + ' Deleted'
  } else if (event.type == 'MemberEvent') {
    return pl.member.login + ' ' + title(pl.action) + ' As a Member'
  } else if (event.type == 'WatchEvent') { // Actually when someone stars a repo
    return event.actor.login + ' Added a Star'
  } else {
    // MemberEvent, OrgBlockEvent,
    // ProjectCardEvent, ProjectColumnEvent, ProjectEvent,
    // DownloadEvent**, ForkApplyEvent**, GistEvent**,
    // MembershipEvent*, MilestoneEvent*, LabelEvent*,
    // OrganizationEvent*, DeploymentEvent*, DeploymentStatusEvent*,
    // PageBuildEvent*, RepositoryEvent*, StatusEvent*,
    // TeamEvent*, TeamAddEvent*
    // * not in timelines
    // ** no longer created
    return event.type.replace(/([a-z])([A-Z])/g, '$1 $2')
  }
}

var NotificationView = Backbone.View.extend({

  initialize: function () {
    this.listenTo(this.collection, 'add', this.notify)
  },

  notify: function (model) {
    if (App.initialLoad) { return }
    var attr = model.attributes
    var title = eventTitle(attr)
    var body = [
      'on', attr.repo.name,
      'by', attr.actor.login,
      'at', new Date(attr.created_at).toLocaleTimeString()
    ].join(' ')
    var icon = localStorage.hideAvatar ? 'favicon.png' : attr.actor.avatar_url
    var notification = new Notification(title, { body: body, icon: icon })
    var url = eventURL(attr)
    notification.onclick = function(event) {
      event.preventDefault()
      App.onClicked()
      window.open(eventURL(attr), '_blank')
    }.bind(this)
    setTimeout(notification.close.bind(notification), 5000)
  },

})

var Router = Backbone.Router.extend({

  routes: {
    ':name': 'watch',
    '': 'index'
  },

  watch: function (name) {
    // Show username in formView
    App.formView.setName(name)

    // Ask permission first
    Notification.requestPermission(function () {
      // Clear interval if any
      clearInterval(this.intervalId)

      // Hide index view
      $('#index').hide()

      // Create a collection to fetch events
      var remote = new Backbone.Collection

      // See https://developer.github.com/v3/activity/events/#list-events-that-a-user-has-received
      remote.url = 'https://api.github.com/users/' + name + '/received_events?per_page=100' + getTokenParam()

      // Create an empty collection that will be used in views
      var local = new Backbone.Collection

      // Create views
      App.listView = new ListView({ collection: local })
      App.notificationView = new NotificationView({ collection: local })

      // Show listView
      $('#list').html(App.listView.el)

      // Poll every minute and save intervalId
      App.intervalId = setInterval(function () {
        console.log('fetch')
        remote.fetch()
      }, getTokenParam() ? 10 * 1000 : 60 * 1000)

      // First fetch
      remote.fetch({
        success: function () {
          remote.url = 'https://api.github.com/users/' + name + '/received_events?per_page=10' + getTokenParam()
          App.initialLoad = true
          remote.forEach(function (model) {
            local.push(model)
          })

          // Add new remote item to the local collection
          remote.on('add', function (model) {
            local.unshift(model)
          })
          setTimeout(function () {
            App.initialLoad = false
          })
        },
        error: function (collection, response) {
          if (response.status === 404) alert('Can\'t find user ' + name)
        }
      })

      // On add, update bubble
      var counter = 0
      App.onClicked = function () {
        --counter
        App.updateCounter()
      }
      ifvisible.on('focus', function () {
        counter = 0
        App.updateCounter()
      })

      remote.on('add', function () {
        if (ifvisible.now()) {
          counter = 0
          App.updateCounter()
        } else {
          ++counter
          App.updateCounter()
        }
        Tinycon.setBubble(counter)
      })
      App.updateCounter = function () {
        Tinycon.setBubble(counter)
      }
    }.bind(this))
  },

  index: function () {
    // Clear interval if any
    clearInterval(App.intervalId)

    // Remove events views
    if (App.listView) App.listView.remove()
    if (App.notificationView) App.notificationView.remove()

    // Reset form view
    App.formView.setName('')

    // Set focus on desktop
    if ("Notification" in window) $('#input').focus()

    // Show index view again
    $('#index').show()
  }

})

function getTokenParam() {
  if (localStorage.getItem('accessToken')) {
    return '&access_token=' + localStorage.getItem('accessToken')
  }
  return ''
}

var App = {}

$(function () {
  if (!("Notification" in window)) $('#alert').removeClass('hidden')
  $('.auth-toggle').click(function (e) {
    e.preventDefault()
    $('.auth-form').toggle()
  })
  $('.auth-form').on('submit', function (e) {
    e.preventDefault()
    localStorage.setItem('accessToken', $('.auth-form input').val())
  })
  var router = new Router()
  App.formView = new FormView({ el: $('#form'), router: router })
  Backbone.history.start()
})
