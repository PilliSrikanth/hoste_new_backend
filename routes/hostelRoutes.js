const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');
const upload = require('../middleware/upload'); // multer
const ownerAuth = require('../middleware/ownerAuth');

router.get('/all', hostelController.getAllHostels);
router.get('/top-rated', hostelController.getTopRatedHostels);
router.get('/search', hostelController.getHostelsByArea);             // ?area=...
router.get('/single/:id', hostelController.getSingleHostel);
router.get('/filter', hostelController.filterByType);                // ?type=boys
router.get('/search-combo', hostelController.searchByAreaAndType);   // ?area=X&type=boys

// geo endpoints
router.get('/nearby', hostelController.getNearbyHostels);            // ?lat=&lng=&radius=
router.get('/nearby/top-rated', hostelController.getTopRatedHostels); // ?lat=&lng=&radius=&limit=5

// create with images (multipart/form-data)
/*router.post(
  '/add',
  upload.any(),
  hostelController.addHostel
);*/


// decrement vacancy when booking
router.post('/book/:id', hostelController.decrementVacancy);

router.get("/user/joined/:userId", hostelController.getUserJoinedHostel);


//admin

  router.get('/owner/:ownerId',ownerAuth, hostelController.getHostelsByOwner);
  router.delete('/delete/:id', hostelController.deleteHostel);
  router.get('/owner/:ownerId/hostel-users', hostelController.getHostelsWithUsers);
  router.get('/:hostelId', hostelController.getHostelById);



router.post('/add', ownerAuth, upload.any(), hostelController.addHostel);


module.exports = router;
