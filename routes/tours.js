const express = require('express');
const Tour = require('../models/tour');
const Comment = require('../models/comment'); 
const catchErrors = require('../lib/async-error');

const router = express.Router();

// login상태 확인
function needAuth(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash('danger', 'Please signin first.');
    res.redirect('/signin');
  }
}

/* GET tours listing. */
router.get('/', needAuth, catchErrors(async (req, res, next) => {
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
  const tours = await Tour.paginate(query, {
    sort: {createdAt: -1}, 
    populate: 'author', 
    page: page, limit: limit
  });
  res.render('tours/index', {tours: tours, term: term, query: req.query});

}));

// 새 게시글 page
router.get('/new', needAuth, (req, res, next) => {
  res.render('tours/new', {tour: {}});
});

// 게시글 수정 page
router.get('/:id/edit', needAuth, catchErrors(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id);
  res.render('tours/edit', {tour: tour});
}));

// 게시글 상세 page
router.get('/:id', catchErrors(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id).populate('author');
  const comments = await Comment.find({tour: tour.id}).populate('author');
  tour.numReads++;    // TODO: 동일한 사람이 본 경우에 Read가 증가하지 않도록???

  await tour.save();
  res.render('tours/show', {tour: tour, comments: comments});
}));

// 게시글 수정 
router.put('/:id', catchErrors(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id);

  if (!tour) {
    req.flash('danger', 'Not exist tour');
    return res.redirect('back');
  }
  tour.title = req.body.title;
  tour.content = req.body.content;
  tour.course = req.body.course;
  tour.cost = req.body.cost;
  tour.destination = req.body.destination.split(" ").map(e => e.trim());

  await tour.save();
  req.flash('success', 'Successfully updated');
  res.redirect('/tours');
}));

// 게시글 삭제 page
router.delete('/:id', needAuth, catchErrors(async (req, res, next) => {
  await Tour.findOneAndRemove({_id: req.params.id});
  req.flash('success', 'Successfully deleted');
  res.redirect('/tours');
}));

// 새 게시글 post
router.post('/', needAuth, catchErrors(async (req, res, next) => {
  const user = req.user;
  var tour = new Tour({
    title: req.body.title,
    author: user._id,
    content: req.body.content,
    course: req.body.course,
    cost: req.body.cost,
    destination: req.body.destination.split(" ").map(e => e.trim()),
  });
  await tour.save();
  req.flash('success', 'Successfully posted');
  res.redirect('/tours');
}));

// comment 달기
router.post('/:id/comments', needAuth, catchErrors(async (req, res, next) => {
  const user = req.user;
  const tour = await Tour.findById(req.params.id);

  if (!tour) {
    req.flash('danger', 'Not exist tour');
    return res.redirect('back');
  }

  var comment = new Comment({
    author: user._id,
    tour: tour._id,
    content: req.body.content
  });// _id ; mongo에서 자동으로 만듦
  await comment.save();
  tour.numComments++;
  await tour.save();

  req.flash('success', 'Successfully commented');
  res.redirect(`/tours/${req.params.id}`);
}));



module.exports = router;
