/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
const bucketName = 'stakingstats';
const srcFilename = 'test_file.txt';
const destFilename = './test_file.txt';

// Imports the Google Cloud client library
const { Storage } = require('@google-cloud/storage');

// Creates a client
const storage = new Storage();

async function downloadFile() {
    const options = {
        // The path to which the file should be downloaded, e.g. "./file.txt"
        destination: destFilename,
    };

    // Downloads the file
    await storage.bucket(bucketName).file(srcFilename).download(options);

    console.log(
        `gs://${bucketName}/${srcFilename} downloaded to ${destFilename}.`
    );
}

downloadFile().catch(console.error);