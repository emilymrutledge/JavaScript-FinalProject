const express = require('express');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const fileupload = require('express-fileupload');
const fs = require('fs');

const app = express();
const{check, validationResult}=require('express-validator')
app.use(express.urlencoded({extended:false}));
app.set('views',path.join(__dirname,'views'));
app.use(express.static(__dirname+'/public'));
app.set('view engine','ejs');
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));
app.use(fileupload());

app.use(session({
    secret:'mysecret',
    resave:false,
    saveUninitialized:true
}));

const User = mongoose.model('user',{
	user: String,
    pass: String, 
});

const Content=mongoose.model('content',{
    slug: String,
    imPath: String,
    content: String
});

mongoose.connect('mongodb://localhost:27017/admin')

app.get('/', (req, res) => {
    Content.find({}).then((pages) => {
        res.render('home', {
            navPages: pages,
            loggedIn: req.session.logIn || false,
            user: req.session.logUser || null
        });
    }).catch((err) => {
        console.log(err);
    });
});

app.get('/login', (req, res) => {
    Content.find({}).then((pages) => {
        res.render('login', {
            loggedIn: false,
            user: null,
            navPages: pages, 
            logoutMessage: req.session.logoutMessage || null,
            logerror: null,
            errors: null
        });
    }).catch((err) => {
        console.log(err);
    });
});


app.post('/login', [
    check('user', 'Username Empty').notEmpty(),
    check('pass', 'Password Empty').notEmpty(),
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        Content.find({}).then((pages) => {
            res.render('login', {
                errors: errors.array(),
                logerror: null,
                logoutMessage: null,
                loggedIn: false,
                user: null,
                navPages: pages
            });
        }).catch((err) => {
            console.log(err);
        });

    } else {
        // No validation errors — check the user in the DB
        User.findOne({ user: req.body.user }).then((data) => {
            if (data && data.pass === req.body.pass) {
                // Login successful
                req.session.logIn = true;
                req.session.logUser = data.user;
                res.redirect('/welcome');
            }else {
                //Login Failed - wrong credentials
                Content.find({}).then((pages)=>{
                    res.render('login', {
                        errors:null,
                        logerror: "Incorrect username or password.",
                        logoutMessage: null,
                        loggedIn: false,
                        user: null,
                        navPages: pages
                    });
                }).catch((err)=>{
                    console.log(err);
                });
            }
        }).catch((err)=>{
            console.log(err);
        });
    }
});


app.get('/welcome',(req,res)=>{
    if(req.session.logIn){
        Content.find({}).then((pages)=>{
            const message = req.session.message;
            delete req.session.message;

            res.render('welcome',{
                logName: req.session.logUser,
                data: pages,
                navPages: pages,
                loggedIn: true,
                user: req.session.logUser,
                message: message
            });        
        }).catch((err)=>{
            console.log(err);
        });
    }else{
        res.redirect('login');
    }
});

app.get('/add',(req,res)=>{
    if(req.session.logIn){
        const message = req.session.message;
        delete req.session.message;

        Content.find({}).then((pages) => {

            res.render('add',{
                logName:req.session.logUser,
                loggedIn: true,
                user: req.session.logUser,
                navPages: pages,
                message: message 
        });
    }).catch((err) => {
        console.log(err);
    });

    }else{
        res.redirect('/');
    }
});
 
app.post('/add', (req, res) => {    
    if (!req.session.logIn) {
        return res.redirect('login');
    }
    
    // Validate essential data
    if (!req.body.slug || !req.body.tar || !req.files || !req.files.imFile) {
        console.log('Missing required data');
        return Content.find({}).then((pages) => {
            res.render('add', {
                errors: [{ msg: '! All fields are required !' }],
                logName: req.session.logUser,
                loggedIn: true,
                user: req.session.logUser,
                navPages: pages
            });
        }).catch(err => {
            console.log('Error finding pages:', err);
        });
    }
    
    const imFile = req.files.imFile;
    const imName = imFile.name;
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    const filePath = path.join(uploadPath, imName);
    const pathStore = '/uploads/' + imName;
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log('Created uploads directory:', uploadPath);
    }
    
    console.log('Moving uploaded file to:', filePath);
    
    // Move the uploaded file
    imFile.mv(filePath, (err) => {
        if (err) {
            console.log('File upload error:', err);
        }
        
        console.log('File moved successfully, creating content document');
        
        // Create new content
        const newContent = new Content({
            slug: req.body.slug,
            imPath: pathStore,
            content: req.body.tar
        });
        
        console.log('Content document created:', newContent);
        
        // Save to database
        newContent.save()
            .then(data => {
                req.session.message = "You have successfully created a new page!";
                console.log('Content saved successfully to database:', data);
                res.redirect('/add');
            })

            .catch(err => {
                console.log('Error saving content to database:', err);
                Content.find({}).then((pages) => {
                    res.render('add', {
                        errors: [{ msg: 'Database error: ' + err.message }],
                        logName: req.session.logUser,
                        loggedIn: true,
                        user: req.session.logUser,
                        navPages: pages
                    });
                }).catch(innerErr => {
                    console.log('Error finding pages:', innerErr);
                });
            });
    });
});

app.get('/edit', (req, res) => {
    if (req.session.logIn) {
        Content.find({}).then((pages) => {
            res.render('editList', {
                logName: req.session.logUser,
                loggedIn: true,
                user: req.session.logUser,
                navPages: pages,
                pages: pages
            });
        }).catch((err) => {
            console.log(err);
        });
    } else {
        res.redirect('welcome');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }

        res.render('logout', {
            loggedIn: false,
            navPages: []
        });
    });
});


//------------------------ Setup the database ---------------------------------

app.get('/page/:id', (req, res) => {
    Content.findOne({ _id: req.params.id }).then((pageData) => {
        Content.find({}).then((pages) => {
            res.render('pageTemplate', {
                page: pageData,
                navPages: pages,
                loggedIn: req.session.logIn || false,
                user: req.session.logUser || null
            });
        });
    }).catch((err) => {
        console.log('Error loading public page:', err);
    });
});

app.get('/edit/:id', (req, res) => {
    if (req.session.logIn) {
        const message = req.session.message;
        delete req.session.message;

        Content.findById(req.params.id).then((page) => {
            Content.find({}).then((pages) => {

                res.render('editPage', {
                    page: page,
                    navPages: pages,
                    loggedIn: true,
                    user: req.session.logUser,
                    message: message
                });
            });
        }).catch((err) => {
            console.log(err);
            res.status(500).send('Error loading page to edit.');
        });
    } else {
        res.redirect('/');
    }
});


app.post('/edit/:id', (req, res) => {
    if (req.session.logIn) {
        let updateData = {
            slug: req.body.slug,
            content: req.body.content
        };

        // If a new image is uploaded
        if (req.files && req.files.imFile) {
            let im = req.files.imFile;
            let imagePath = 'public/uploads/' + im.name;
            let imPathForDB = '/uploads/' + im.name;

            // Move image to uploads folder
            im.mv(imagePath, (err) => {
                if (err) {
                    console.log(err);
                }
            });

            // Add image path to update
            updateData.imPath = imPathForDB;
        }

        Content.findByIdAndUpdate(req.params.id, updateData).then(() => {
            req.session.message = "You have successfully edited the page";
            res.redirect(`/edit/${req.params.id}`);

        }).catch((err) => {
            console.log(err);
        });

    } else {
        res.redirect('/');
    }
});

app.get('/delete/:id', (req, res) => {
    if (req.session.logIn) {
        Content.findByIdAndDelete(req.params.id)
            .then(() => {
                res.render('confirmDelete', {
                    loggedIn: true,
                    user: req.session.logUser,
                    navPages: pages
                });
                
            })
            .catch((err) => {
                console.log(err);
            });
    } else {
        res.redirect('/');
    }
});



//----------- Start the server -------------------

app.listen(8080);
console.log('Server started at 8080...');






















