function get_date() {
    let today = new Date();
    let date_as_string = "";
    date_as_string += today.getMonth() + 1;
    date_as_string += '_' + today.getDate();
    date_as_string += '_' + today.getFullYear();
    return date_as_string;
}




const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function test() {
    let todays_date = get_date();
    const data = {
        date: todays_date,
        stats: 'test stats',
    };

    // Add a new document in collection "cities" with ID 'LA'
    const res = await db.collection('stats').doc(get_date()).set(data);
}

test()