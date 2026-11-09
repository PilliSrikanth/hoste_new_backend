const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadPath = path.join(
  __dirname,
  '../uploads/users'
);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true
  });
}

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {

    const extension =
      path.extname(file.originalname);

    const filename =
      `user-${req.params.id}-${Date.now()}${extension}`;

    cb(null, filename);
  }

});


const fileFilter = (req, file, cb) => {

  if (file.mimetype.startsWith('image/')) {

    cb(null, true);

  } else {

    cb(
      new Error('Only image files are allowed'),
      false
    );

  }

};


const uploadUserImage = multer({

  storage,

  fileFilter,

  limits: {
    fileSize: 100 * 1024 * 1024
  }

});


module.exports = uploadUserImage;