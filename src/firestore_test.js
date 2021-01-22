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

async function add_test() {
    let todays_date = get_date();
    const data = {
        date: todays_date,
        stats: 'test statsssss',
    };

    const res = await db.collection('stats').doc(get_date()).set(data);
}

async function get_test() {
    let todays_date = get_date();
    const todays_info = await db.collection('stats').doc(get_date()).get();
    if(!todays_info) {
        console.log('no file exists!')
    }
    else {
        console.log(JSON.stringify(todays_info.data(), null, '\t'))
    }
}

add_test()
get_test()