const express = require('express');
const Event = require('../models/event');
const Join = require('../models/join'); 
const catchErrors = require('../lib/async-error');


module.exports = io => {
  const router = express.Router();
  
  // 동일한 코드가 users.js에도 있습니다. 이것은 나중에 수정합시다.
  function needAuth(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash('danger', 'Please signin first.');
      res.redirect('/signin');
    }
  }
  function validateForm(form, options) {
    var title = form.title || "";
    var organizerName = form.organizerName || "";
    var organizerDescription = form.organizerDescription || "";
    var content = form.content || "";
    var location = form.location || "";
    var startTime = form.startTime || "";
    var endTime = form.endTime || "";
    title = title.trim();
    organizerName = organizerName.trim();
    organizerDescription = organizerDescription.trim();
    content = content.trim();
    location = location.trim();
    startTime = startTime.trim();
    endTime = endTime.trim();
  
    if (!title) {
      return 'Title is required.';
    }
  
    if (!organizerName) {
      return 'Organizer Name is required.';
    }
    if (!organizerDescription) {
      return 'Organizer Descriptionis required.';
    }
  
    if (!content) {
      return 'Description is required.';
    }
  
    if (!location) {
      return 'location is required.';
    }
    if (!startTime) {
      return 'Start Time is required.';
    }
    if (!endTime) {
      return 'End Time is required.';
    }
  
  
    return null;
  }
  /* GET events listing. */
  router.get('/', catchErrors(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    var query = {};
    const term = req.query.term;
    if (term) {
      query = {$or: [
        {title: {'$regex': term, '$options': 'i'}},
        {content: {'$regex': term, '$options': 'i'}}
      ]};
    }
    const events = await Event.paginate(query, {
      sort: {createdAt: -1}, 
      populate: 'author', 
      page: page, limit: limit
    });
    res.render('events/index', {events: events, term: term, query: req.query});
  }));

  router.get('/new', needAuth, (req, res, next) => {
    res.render('events/new', {event: {}});
  });

  router.get('/:id/edit', needAuth, catchErrors(async (req, res, next) => {
    const event = await Event.findById(req.params.id);
    res.render('events/edit', {event: event});
  }));

  router.get('/:id', catchErrors(async (req, res, next) => {
    const event = await Event.findById(req.params.id).populate('author');
    const joins = await Join.find({event: event.id}).populate('author');
    event.numReads++;    // TODO: 동일한 사람이 본 경우에 Read가 증가하지 않도록???

    await event.save();
    res.render('events/show', {event: event, joins: joins});
  }));

  router.put('/:id', catchErrors(async (req, res, next) => {
    // const event = await Event.findById(req.params.id);
    const err = validateForm(req.body);
    if (err) {
      req.flash('danger', err);
      return res.redirect('back');
    }
    if (!event) {
      req.flash('danger', 'Not exist event');
      return res.redirect('back');
    }
    event.title = req.body.title;
    event.content = req.body.content;
    event.location = req.body.location;
    event.startTime = req.body.startTime;
    event.endTime = req.body.endTime;
    event.organizerName = req.body.organizerName;
    event.organizerDescription = req.body.organizerDescription;
    event. fee = req.body.fee;
    event.tags = req.body.tags.split(" ").map(e => e.trim());

    await event.save();
    req.flash('success', 'Successfully updated');
    res.redirect('/events');
  }));

  router.delete('/:id', needAuth, catchErrors(async (req, res, next) => {
    await Event.findOneAndRemove({_id: req.params.id});
    req.flash('success', 'Successfully deleted');
    res.redirect('/events');
  }));

  router.post('/', needAuth, catchErrors(async (req, res, next) => {
    const user = req.user;
    const err = validateForm(req.body);
    if (err) {
      req.flash('danger', err);
      return res.redirect('back');
    }
    var event = new Event({
      title: req.body.title,
      author: user._id,
      content: req.body.content,
      location: req.body.location,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      organizerName: req.body.organizerName,
      organizerDescription: req.body.organizerDescription,
      fee: req.body.fee,
      tags: req.body.tags.split(" ").map(e => e.trim()),
    });
    await event.save();
    req.flash('success', 'Successfully posted');
    res.redirect('/events');
  }));

  router.post('/:id/joins', needAuth, catchErrors(async (req, res, next) => {
    const user = req.user;
    const event = await Event.findById(req.params.id);

    if (!event) {
      req.flash('danger', 'Not exist event');
      return res.redirect('back');
    }

    var join = new Join({
      author: user._id,
      event: event._id,
      content: req.body.content
    });
    await join.save();
    event.numJoins++;
    await event.save();

    const url = `/events/${event._id}#${join._id}`;
    io.to(event.author.toString())
      .emit('joined', {url: url, event: event});
    console.log('SOCKET EMIT', event.author.toString(), 'joined', {url: url, event: event})
    req.flash('success', 'Successfully joined');
    res.redirect(`/events/${req.params.id}`);
  }));

  return router;
}