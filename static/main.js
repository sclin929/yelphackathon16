var origin, dest;
var autocompleteOrigin, autocompleteDest;
var map;
var dirService, dirDisplay;

var navbarView = false;
var isCleared = false;
var offset = 0;
var numRestaurants = Infinity;
var originMarkers = [];
var destMarkers = [];
var restMarkers = [];
var searchResults = [];
var restCategories = {};

var LAT_COORD_BUFFER = 0.0125;
var LNG_COORD_BUFFER = 0.0005;

// Used to resize results div upon window resize
$(document).ready(function() {
  $(window).resize(function() {
    var windowHeight = $(window).height();
    $(".results").height(windowHeight - 365);
  }).resize();
});

// Method to initialize basic app functions
function initialize() {
  map = new google.maps.Map(document.getElementById('map'), {
    // center: {lat: 37.7867093, lng: -122.4020356},
    zoom: 13,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  geolocate();  // Center map in user's geographical region

  // Set autocomplete on the origin input field and 
  // bind input content to map
  origin = document.getElementById('origin');
  autocompleteOrigin = new google.maps.places.Autocomplete(origin);
  autocompleteOrigin.bindTo('bounds', map);
  autocompleteOrigin.addListener('place_changed', findOrigin);

  // Set autocomplete on the destination input field and 
  // bind input content to map
  dest = document.getElementById('destination');
  autocompleteDest = new google.maps.places.Autocomplete(dest);
  autocompleteDest.addListener('place_changed', findDestination);

  // Initialize direction services and rendering
  dirService = new google.maps.DirectionsService();
  dirDisplay = new google.maps.DirectionsRenderer();
  dirDisplay.setMap(map);

  // Add listeners for Go button when a query is made
  var goButton = document.getElementById('go-button');
  google.maps.event.addDomListener(goButton, 'click', animateView);
  google.maps.event.addDomListener(goButton, 'click', calculateRoute);
  google.maps.event.addDomListener(goButton, 'click', findRestaurants);
}

// Identifies the user's current location and centers map on the
// user's geographical location
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

// Sets the origin of the route
function findOrigin() {
  var place = autocompleteOrigin.getPlace();

  if (!place.geometry) {
    window.alert("Please enter a valid starting location.");
    return;
  }

  if (!isCleared) {
    clearQuery();
  }
  
  findLocation(place, originMarkers, true);
}

// Sets the destination of the route
function findDestination() {
  var place = autocompleteDest.getPlace();
  if (!place.geometry) {
    window.alert("Please enter a valid destination.");
    return;
  }

  if (!isCleared) {
    clearQuery();
  }

  findLocation(place, destMarkers, false);
}

// Sets a location and marks it on the map
function findLocation(place, markerArr, isOrigin) {
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

  if (isOrigin) {
    originMarkers = markerArr;
  } else {
    destMarkers = markerArr;
  }

  if (origin.value !== '' && dest.value !== '') { 
    fitMapToMarkers();
  }
}

// Clears query value and results
function clearQuery() {
  dirDisplay.setMap(null);

  if (originMarkers !== undefined && originMarkers.length > 0) {
    originMarkers.forEach(function(marker) {
      marker.setMap(null);
    });
  }

  if (destMarkers !== undefined && destMarkers.length > 0) {
    destMarkers.forEach(function(marker) {
      marker.setMap(null);
    });
  }

  if (restMarkers !== undefined && restMarkers.length > 0) {
    restMarkers.forEach(function(marker) {
      marker.setMap(null);
    });
  }

  originMarkers = [];
  destMarkers = [];
  restMarkers = [];
  searchResults = [];
  isCleared = true;
}

// Fits the map to all existing markers
function fitMapToMarkers() {
  var bounds = new google.maps.LatLngBounds();
  originMarkers.forEach(function(marker) {
    bounds.extend(marker.position);
  });

  destMarkers.forEach(function(marker) {
    bounds.extend(marker.position);
  });

  if (restMarkers !== undefined) {
    restMarkers.forEach(function(marker) {
      bounds.extend(marker.position);
    });
  }
  
  map.fitBounds(bounds);
}

// Uses direction services to calculate route between
// origin and destination
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

// Performs transition from home view to query view
function animateView() {
  if (origin.value === '' || dest.value === '') { 
    return;
  }

  if (!navbarView) {
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
        'margin-top': '0px'
      }, 250, function() {
        createSearchBar();
      });

      $(".map").animate({
        top: '95px',
        bottom: 'auto'
      }, 250, function() {
        fitMapToMarkers();   
        $(".results").css("display", "flex");
      });
    });
  }

  var createSearchBar = function() {
    $(".query-form").css("position", "absolute");
    $(".app-name").css("display", "inline");
    $(".app-name").css("position", "absolute");
    $(".app-name").css("left", "10px");
    $(".app-name").css("line-height", "35px");
  }

  navbarView = true;
}

// Performs Yelp Search API call to find restaurants along a route
function findRestaurants() {
  $.ajax({
    url: '/findRestaurants',
    data: {
      swLat: originMarkers[0].getPosition().lat()-LAT_COORD_BUFFER,
      swLng: originMarkers[0].getPosition().lng()-LNG_COORD_BUFFER,
      neLat: destMarkers[0].getPosition().lat()+LAT_COORD_BUFFER,
      neLng: destMarkers[0].getPosition().lng()+LNG_COORD_BUFFER,
      offset: offset
    },
    dataType: 'json',
    success: function(data, status, res) {
      numRestaurants = data.total;
      searchResults = data.businesses;

      displayResults(numRestaurants);
      populateMap();
      isCleared = false;
    },
    error: function(data, status, res) {
      alert('Request for restaurants failed. Please try again.');
    }
  });
}

// Updates the UI to show query results
function displayResults(numRestaurants) {
  $(".results-title").delay(100).text(numRestaurants + " restaurants found");
}

// Populates the results on the map
function populateMap() {
  searchResults.forEach(function(result, i) {
    var resLatLng = {lat: result.location.coordinate.latitude, 
                     lng: result.location.coordinate.longitude};

    // Create content for info window
    var content = "<div class='info-window'><div class='info-title'>" 
                    + result.name + "</div></div>";
    var resAddress = result.location.display_address;
    for (var i = 0; i < resAddress.length; i++) {
      content += "<div>" + resAddress[i] + "</div>";
    }

    var infoWindow = new google.maps.InfoWindow({
      content: content
    });
    
    restMarkers.push(new google.maps.Marker({
      map: map,
      position: resLatLng,
      infowindow: infoWindow,
      cursor: 'pointer'
    }));
  });

  restMarkers.forEach(function(restMarker) {
    google.maps.event.addListener(restMarker, 'mouseover', function() {
      restMarker.infowindow.open(map, restMarker);
    });
    google.maps.event.addListener(restMarker, 'mouseout', function() {
      restMarker.infowindow.close(map, restMarker);
    });
  });

  fitMapToMarkers();
}