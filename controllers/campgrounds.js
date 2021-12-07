const Campground = require('../models/campground');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require('../cloudinary');


module.exports.index = async (req, res) => {       //displays camps list on mainpage
    const campgrounds = await Campground.find({}).populate({
        path: 'popupText',
        strictPopulate: false,
    });
    res.render('campgrounds/index', { campgrounds })
}

module.exports.renderNewForm = (req, res) => {          // creates form to add new camp
    res.render('campgrounds/new');       // all that app.get-line has to be above 'display code', otherwise js treats 'new' as an id
}

module.exports.createCampground = async (req, res, next) => { // adds new camp to mainpage and db
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send()
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.author = req.user._id;   //adds username to author 
    await campground.save();
    console.log(campground);
    req.flash('success', 'New Campground Added!');
    res.redirect(`/campgrounds/${campground._id}`);

}

module.exports.showCampground = async (req, res) => {       //displays camp details
    const { id } = req.params;
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author',
        }
    }).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find Campground');       //displays error message while trying to show campground that doesn't exist in db
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/show', { campground })
}

module.exports.renderEditForm = async (req, res) => {    //allows to edit camps
    const { id } = req.params;
    const campground = await Campground.findById(id);    //requires method-override (npm i)
    if (!campground) {
        req.flash('error', 'Cannot find Campground');       //displays error message while trying to EDIT campground that doesn't exist in db
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });

}


module.exports.updateCampground = async (req, res) => {
    const { id } = req.params;
    const geoData = await geocoder
        .forwardGeocode({
            query: req.body.campground.location,
            limit: 1,
        })
        .send();
    const campground = await Campground.findByIdAndUpdate(id, {
        ...req.body.campground,
    });
    const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
    campground.images.push(...imgs);
    campground.geometry = geoData.body.features[0].geometry;
    await campground.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({
            $pull: { images: { filename: { $in: req.body.deleteImages } } },
        });
    }
    console.log(campground);
    req.flash("success", "Successfully update a campground");
    res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.deleteCampground = async (req, res) => {        //deleting
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted campground')
    res.redirect('/campgrounds');

}