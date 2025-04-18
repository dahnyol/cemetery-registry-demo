const express = require('express');
const app = express();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const session = require('express-session');

const PORT = process.env.PORT || 3000;

// Connect to supabase DB
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
// Parse URL data into object for POST and PUT requests to server
app.use(express.urlencoded({extended:true}));
app.use(express.json());

// Set server to expect EJS and where to find it
app.set('view engine', 'ejs');
app.set('views', './views');

// Set path to CSS style
app.use('/', express.static('public'));

// Set session length to 10 minutes
app.use(session({
    secret: 'your secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 600000,       
    }
}))

// Routes
// GET to render our homepage
app.get('/', (req, res) => {
    res.render('index', {records: null});
})

// GET to render login page
app.get('/loginPage', (req, res) => {
    res.render('login');
});

// GET to render update page
app.get('/updatePage', (req, res) => {
    if (req.session.authenticated) {
        res.render('update', {record: null, message: null});
    } else {
        res.render('login');
    }
});

// Handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
    })
    
    if (error) {
        console.error('login error', error.message);
        return res.status(401).send('Login failure. Please contact administrator.');
    }
    
    // Authenticate current user session
    // If multiple users - need to add query to match/specify userId in DB
    req.session.userId = 'admin';
    req.session.authenticated = true;

    res.redirect('/updatePage');
})

// If multiple users - modify session.destroy to target specific user id 
app.get('/logout', (req, res) => {
    req.session.destroy((error => {
        if (error) {
            console.error('Session not destroyed', error.message);
            return res.status(500).send('Could not log out, please try again.');
        }
        res.redirect('/'); // Redirect to home page or login page after logging out
    }))
})

// Search for specific data
// GET to fetch DB data - main page
app.get('/search', async (req, res) => {
    // Grab data from form and store to appropriate var
    const { lastName, firstName, birthYear, deathYear } = req.query;
    
    // Define/Create SQL prompt to search supabase DB
    // select * from cemetery_records where name_last like ('%lastName%') order by name_last asc;
    let query = supabase
        .from('cemetery_records')
        .select(`
            ID,
            TITLE,
            SURNAME,
            FIRSTNAME,
            MAIDEN,
            MIDDLE,
            BIRTH_DATE,
            DEATH_DATE,
            AGE,
            SECTION,
            LOT,
            IS_VET,
            NOTES,
            MOVED_FROM,
            MOVED_TO
            `)
        .order('SURNAME', {ascending: true});

    // Partial match will return 
    if (lastName) {
        query = query.ilike('SURNAME', `%${lastName}%`);
    }
    if (firstName) {
        query = query.ilike('FIRSTNAME', `%${firstName}%`);
    }

    // Exact match will return
    if (birthYear) {
        query = query.eq('BIRTH_YEAR', birthYear);
    }
    if (deathYear) {
        query = query.eq('DEATH_YEAR', deathYear);
    }
    
    // GET request with defined SQL prompt/query to supabase DB
    try {
        let { data, error } = await query;
        if (error) {
            throw error;
        }
        console.log(data)
        res.render('index', {records: data});
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send('Internal Server Error.');        
    }
})

// Show existing DB date for record to update
app.get('/getUpdateRecord', async (req, res) => {
    const memorialID = req.query.memorialID;

    let query = supabase
        .from('cemetery_records')
        .select(`
            ID,
            TITLE,
            SURNAME,
            FIRSTNAME,
            MAIDEN,
            MIDDLE,
            BIRTH_DATE,
            DEATH_DATE,
            AGE,
            SECTION,
            LOT,
            IS_VET,
            NOTES,
            MOVED_FROM,
            MOVED_TO
            `)
        .eq('ID', memorialID)
    
    try {
        let { data, error } = await query;
        if (error) {
            throw error;
        } 
        // Supabase returns array of objects, store object into var 
        let dataObject = data[0];
        if (dataObject) {
            res.render('update', {record: dataObject});
        } else {
            res.render('update', {record: null, message: 'No record found.'});
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
})

// Update our DB with our new data sent in form 
app.post('/updateRecord', async (req, res) => {
    if (req.session.authenticated) {
        try {
            const updatedData = await updateRecordInSupabase(req.body);
            res.render('update', {record: null, message: 'Record update successful.'});
        } catch (error) {
            console.error('Error updating record:', error);
            res.render('update', {record: null, message: 'Error updating record. Update not successful.'});
        }
    } else {
        res.render('login');
    }
})

async function updateRecordInSupabase(formData) {
    try {
        console.log(formData);
        const recordId = formData.ID
        // delete the memorial_ID from object to preserve the ID
        delete formData.ID;
        const { data, error } = await supabase
            .from('cemetery_records')
            .update(formData)
            .eq('ID', recordId);
        if (error) throw error;
    } catch (error) {
        console.error('Error updating record in Supabase:', error);
        throw error; // re-throw the error to tbe handled by the calling function
    }
}

app.listen(PORT, () => {
    console.log(`Server is running ${PORT}`);
})