var origin, dest;
var autocompleteOrigin, autocompleteDest;
var map, originMarkers, destMarkers;
var dirService, dirDisplay;
var navbarView = false;
var searchResults;

var addressComponents = {
  street_number: 'short_name',
  route: 'short_name',
  locality: 'long_name',
  administrative_area_level_1: 'short_name',
  postal_code: 'long_name'
};

// Setting autocomplete on the origin and destination input fields
function initialize() {
  map = new google.maps.Map(document.getElementById('map'), {
    // center: {lat: 37.7867093, lng: -122.4020356},
    zoom: 13,
    panControl: false,
    streetViewControl: false,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  geolocate();

  originMarkers = [];
  destMarkers = [];

  origin = document.getElementById('origin');
  autocompleteOrigin = new google.maps.places.Autocomplete(origin);
  autocompleteOrigin.bindTo('bounds', map);
  autocompleteOrigin.addListener('place_changed', findOrigin);

  dest = document.getElementById('destination');
  autocompleteDest = new google.maps.places.Autocomplete(dest);
  autocompleteDest.addListener('place_changed', findDestination);

  dirService = new google.maps.DirectionsService();
  dirDisplay = new google.maps.DirectionsRenderer();
  dirDisplay.setMap(map);

  var goButton = document.getElementById('go-button');
  if (!navbarView) {
    google.maps.event.addDomListener(goButton, 'click', animateView);
  }
  google.maps.event.addDomListener(goButton, 'click', calculateRoute);
  google.maps.event.addDomListener(goButton, 'click', findRestaurants);
}

function geolocate() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var geolocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      map.setCenter(new google.maps.LatLng(geolocation.lat, geolocation.lng));
    });
  }
}

function findOrigin() {
  var place = autocompleteOrigin.getPlace();
  if (!place.geometry) {
    window.alert("Please enter a valid starting location.");
    return;
  }

  findLocation(place, originMarkers, true);
}

function findDestination() {
  var place = autocompleteDest.getPlace();
  if (!place.geometry) {
    window.alert("Please enter a valid destination.");
    return;
  }

  findLocation(place, destMarkers, false);
}

function findLocation(place, markerArr, isOrigin) {
  dirDisplay.setMap(null);
  markerArr.forEach(function(marker) {
    marker.setMap(null);
  });
  markerArr = [];

  if (isOrigin) {
    markerArr.push(new google.maps.Marker({
      map: map,
      icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      position: place.geometry.location
    }));
  
  } else {
    markerArr.push(new google.maps.Marker({
      map: map,
      icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
      position: place.geometry.location
    }));
  }

  if (place.geometry.viewport) {
    map.fitBounds(place.geometry.viewport);
  } else {
    map.setCenter(place.geometry.location);
  }

  markerArr.forEach(function(marker) {
    marker.setVisible(true);
  });

  if (isOrigin) {
    originMarkers = markerArr;
  } else {
    destMarkers = markerArr;
  }

  if (origin.value !== '' && dest.value !== '') { 
    fitMapToMarkers();
  }
}

function fitMapToMarkers() {
  var bounds = new google.maps.LatLngBounds();
  originMarkers.forEach(function (marker) {
    bounds.extend(marker.position);
  });

  destMarkers.forEach(function (marker) {
    bounds.extend(marker.position);
  });
  
  map.fitBounds(bounds);
}

function calculateRoute() {
  if (origin.value === '' || dest.value === '') { 
    window.alert("Please provide a starting location and a destination.");
    return;
  }

  var start = originMarkers[0].position;
  var end = destMarkers[0].position;
  var request = {
    origin: start,
    destination: end,
    travelMode: google.maps.TravelMode.DRIVING
  };

  dirService.route(request, function(res, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      dirDisplay.setDirections(res);
      dirDisplay.setMap(map);
      originMarkers[0].setVisible(false);
      destMarkers[0].setVisible(false);
    } else {
      window.alert("Request for directions failed. Please try again.");
      return;
    }
  })
}

function animateView() {
  if (origin.value === '' || dest.value === '') { 
    return;
  }

  $(".map").animate({
    'margin-top': '-=45px'
  }, 300, 'swing', function() {
    $(".title-content").css("display", "hidden");
  });

  $(".query-form").animate({
    'margin-top': '-=25px',
  }, 300, 'swing', function() {
    $(".query-form").animate({
      top: '0px',
      'margin-top': ''
    }, 250, function() {
      createSearchBar();
    });

    $(".map").animate({
      top: '95px',
      bottom: 'auto'
    }, 250, function() {
      fitMapToMarkers();
    });
  });

  var createSearchBar = function() {
    $(".query-form").css("position", "absolute");
    $(".query-title").css("display", "inline");
    $(".query-title").css("position", "absolute");
    $(".query-title").css("left", "10px");
    $(".query-title").css("line-height", "35px");
  }

  navbarView = true;
}

function findRestaurants() {
  $.ajax({
    url: '/findRestaurants',
    data: {
      swLat: originMarkers[0].getPosition().lat(),
      swLng: originMarkers[0].getPosition().lng(),
      neLat: destMarkers[0].getPosition().lat(),
      neLng: destMarkers[0].getPosition().lng()
    },
    dataType: 'json',
    success: function(data, status, res) {
      // console.log(JSON.stringify(data, null, 2));
      searchResults = JSON.stringify(data);
      console.log(searchResults);
    },
    error: function(data, status, res) {
      alert('Request for restaurants failed. Please try again.');
    }
  });
}