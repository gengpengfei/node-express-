var fs = require('fs');
var path = require('path');
var sha1 = require('sha1');
var express = require('express');
var router = express.Router();

var UserModel = require('../models/users');
var checkNotLogin = require('../middlewares/check').checkNotLogin;

//----退出登录
router.get('/loginout', function(req, res, next) {
    // 清空 session 中用户信息
    req.session.user = null;
    req.flash('success', '登出成功');
    // 登出成功后跳转到主页
    res.redirect('/');
});
//----登录页面
router.get('/login', function(req, res, next) {
    res.render('login');
});
//----提交登录
router.post('/login', function(req, res, next) {
    var name = req.fields.name;
    var password = req.fields.password;
    UserModel.getUserByName(name)
        .then(function (user) {
            if (!user) {
                req.flash('error', '用户不存在');
                return res.redirect('/users/login');
            }
            // 检查密码是否匹配
            if (sha1(password) !== user.password) {
                req.flash('error', '用户名或密码错误');
                return res.redirect('/users/login');
            }
            req.flash('success', '登录成功');
            // 用户信息写入 session
            delete user.password;
            req.session.user = user;
            // 跳转到主页
            res.redirect('/');
        })
        .catch(next);
});

//----注册页面
router.get('/reg',function(req, res, next) {
    res.render('reg');
});
//----提交注册
router.post('/reg',function(req, res, next) {
    var name = req.fields.name;
    var gender = req.fields.gender;
    var bio = req.fields.bio;
    var avatar = req.files.avatar.path.split(path.sep).pop();
    var password = req.fields.password;
    var repassword = req.fields.repassword;
    // 校验参数
    try {
        if (!(name.length >= 1 && name.length <= 10)) {
            throw new Error('名字请限制在 1-10 个字符');
        }
        if (password.length < 6) {
            throw new Error('密码至少 6 个字符');
        }
        if (password !== repassword) {
            throw new Error('两次输入密码不一致');
        }
        if (['m', 'f', 'x'].indexOf(gender) === -1) {
            throw new Error('性别只能是 m、f 或 x');
        }
        if (!req.files.avatar.name) {
            throw new Error('缺少头像');
        }
        if (!(bio.length >= 1 && bio.length <= 30)) {
            throw new Error('个人简介请限制在 1-30 个字符');
        }

    }
    catch (e) {
        // 注册失败，异步删除上传的头像
        fs.unlink(req.files.avatar.path);
        req.flash('error', e.message);
        return res.redirect('/users/reg');
    }

    // 明文密码加密
    password = sha1(password);

    // 待写入数据库的用户信息
    var user = {
        name: name,
        password: password,
        gender: gender,
        bio: bio,
        avatar: avatar
    };
    // 用户信息写入数据库
    UserModel.create(user)
        .then(function (result) {
            // 此 user 是插入 mongodb 后的值，包含 _id
            user = result.ops[0];
            // 将用户信息存入 session
            delete user.password;
            req.session.user = user;
            // 写入 flash
            req.flash('success', '注册成功了');
            // 跳转到首页
            res.redirect('/');
        })
        .catch(function (e) {
            // 注册失败，异步删除上传的头像
            fs.unlink(req.files.avatar.path);
            // 用户名被占用则跳回注册页，而不是错误页
            if (e.message.match('E11000 duplicate key')) {
                req.flash('error', '用户名已被占用');
                return res.redirect('/users/reg');
            }
            next(e);
        });
});
module.exports = router;
