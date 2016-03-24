var origin, dest;
var autocompleteOrigin, autocompleteDest;
var map;
var dirService, dirDisplay;

// Constant variables
var LAT_COORD_BUFFER = 0.00005;
var LNG_COORD_BUFFER = 0.00005;
var LIMIT_PER_PAGE = 20;

// Global variables
var navbarView = false;
var totalNumRestaurants = Infinity;
var numRestaurants = Infinity;
var rangeBegin = 1;
var currentPage = 0;

var originMarkers = [], destMarkers = [];
var swLat = 0, swLng = 0, neLat = 0, neLng = 0;

// Arrays
var searchResults = [];   /* Array of JSONs for each business */
var restMarkers = [];     /* Array of markers for each business */

// Dictionaries
var pageResults = {};       /* Page number to set of restaurants */
var currPageResults = {};   /* Page number to set of filtered restaurants */
var markerDict = {};        /* Restaurant ID to marker on map */
var restCategories = {};    /* Category to set of restaurants */

// Used to resize results div upon window resize
$(document).ready(function() {
  $(window).resize(function() {
    var windowHeight = $(window).height();
    var windowWidth = $(window).width();
    $(".results").height(windowHeight - 365);
    $(".results").width(windowWidth);

    var resultsWidth = $(".results").width();
    $(".results-filter").width(resultsWidth-20);

    var resultsHeight = $(".results").height();
    $(".results-list").height(resultsHeight-50);
    $(".results-list").width(resultsWidth-100);

    var listHeight = $(".results-list").height();
    $(".no-results").css("margin-top", (listHeight - 30)/2);

    var arrowHeight = $(".arrow").height();
    $(".arrow").css("bottom", ((listHeight - arrowHeight)/2) + 10);
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
  
  var isOrigin = true;
  clearQuery(isOrigin);
  findLocation(place, originMarkers, isOrigin);
}

// Sets the destination of the route
function findDestination() {
  var place = autocompleteDest.getPlace();
  if (!place.geometry) {
    window.alert("Please enter a valid destination.");
    return;
  }

  var isOrigin = false;
  clearQuery(isOrigin);
  findLocation(place, destMarkers, isOrigin);
}

// Sets a location and marks it on the map
function findLocation(place, markerArr, isOrigin) {
  if (isOrigin) {
    markerArr = [new google.maps.Marker({
      map: map,
      icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      position: place.geometry.location
    })];
  
  } else {
    markerArr = [new google.maps.Marker({
      map: map,
      icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
      position: place.geometry.location
    })];
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

      var routeBounds = res.routes[0].bounds;
      swLat = routeBounds.getSouthWest().lat();
      swLng = routeBounds.getSouthWest().lng();;
      neLat = routeBounds.getNorthEast().lat();
      neLng = routeBounds.getNorthEast().lng();

      dirDisplay.setMap(map);
      originMarkers[0].setVisible(false);
      destMarkers[0].setVisible(false);

      findRestaurants();
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
        $(".results").css("display", "inline");
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

// Performs Yelp Search API call to find restaurants along a route
function findRestaurants() {
  var offset = 0;
  callSearchApi(offset);
}

function callSearchApi(offset) {
  $.ajax({
    url: '/findRestaurants',
    data: {
      swLat: swLat+LAT_COORD_BUFFER,
      swLng: swLng+LNG_COORD_BUFFER,
      neLat: neLat+LAT_COORD_BUFFER,
      neLng: neLng+LNG_COORD_BUFFER,
      offset: offset
    },
    dataType: 'json',
    success: function(data, status, res) {
      totalNumRestaurants = (data.total > 1000) ? 1000 : data.total;
      numRestaurants = totalNumRestaurants;
      searchResults = data.businesses;

      // Populate global variables
      createRestDictionary();
      pageResults = createPageResults(searchResults);
      currPageResults = pageResults;

      // Render UI for query results
      displayResults();
    },
    error: function(data, status, res) {
      alert('Request for restaurants failed. Please try again.');
    }
  });
}

// Populates restCategories to maps a category (string) 
// to a set of restaurants
function createRestDictionary() {
  searchResults.forEach(function(result) {
    var restCat = result.categories;
    
    restCat.forEach(function(category) {
      category.forEach(function(subcat) {
        var currCat = subcat.toLowerCase();
        if (!(currCat in restCategories)) {
          restCategories[currCat] = new Set();
        }

        restCategories[currCat].add(result);
      });
    });
  });
}

// Updates the UI to show query results
function displayResults() {
  if (numRestaurants >= 1000) {
    $(".results-title").delay(50).text(numRestaurants + "+ restaurants found");
  } else {
    $(".results-title").delay(50).text(numRestaurants + " restaurants found");
  }

  $(".results-title").append("<div class='results-caption'>Showing 0-0 of 0</div>");
  currentPage = 0;  /* Current page always begins at 0 */
  rangeBegin = 1;
  manageButtonDisplay();
  populatePage();
  populateMap();
}

// Populate pageResults to map a page index to
// a list of restaurants
function createPageResults(resultsList) {
  var pageToRestaurants = {};
  var numPages = Math.ceil(resultsList.length/LIMIT_PER_PAGE);

  var resultsCopy = resultsList;
  for (var i = 0; i < numPages; i++) {
    var arrLength = resultsCopy.length;
    var endIndex = (LIMIT_PER_PAGE > arrLength) ? arrLength : LIMIT_PER_PAGE;
    
    var restSubset = resultsCopy.splice(0, endIndex);
    pageToRestaurants[i] = restSubset;
  }

  return pageToRestaurants;
}

function decrementPage() {
  if (currentPage > 0) {
    rangeBegin -= LIMIT_PER_PAGE;
    clearResults();
    currentPage -= 1;
    manageButtonDisplay();
    populatePage();
    populateMap();
  }
}

function incrementPage() {
  var maxNumPages = Math.ceil(numRestaurants/LIMIT_PER_PAGE);

  if (currentPage < maxNumPages-1) {
    rangeBegin += LIMIT_PER_PAGE;
    clearResults();
    currentPage += 1;
    manageButtonDisplay();
    populatePage();
    populateMap();
  }
}

function manageButtonDisplay() {
  var maxNumPages = Math.ceil(numRestaurants/LIMIT_PER_PAGE);
  
  // All cases for navigation arrows depending on page
  if (currentPage == 0 && maxNumPages == 1) {
    $("#left-arrow").hide();
    $("#right-arrow").hide();

  } else if (currentPage == 0) {
    $("#left-arrow").hide();
    $("#right-arrow").show();

  } else if (currentPage == maxNumPages-1) {
    $("#right-arrow").hide();
    $("#left-arrow").show();

  } else {
    $("#left-arrow").show();
    $("#right-arrow").show();
  }
}

// UI for results list
function populatePage() {
  var rangeEnd = rangeBegin + LIMIT_PER_PAGE - 1;
  rangeEnd = (rangeEnd > numRestaurants) ? numRestaurants : rangeEnd;

  // Display text to indicate range of restaurants shown
  if (numRestaurants >= 1000) {
    $(".results-caption").text(
      "Showing " + rangeBegin + "-" 
        + rangeEnd + " of " + "1000+"
    );
  } else {
    $(".results-caption").text(
      "Showing " + rangeBegin + "-" 
        + rangeEnd + " of " + numRestaurants
    );
  }

  // If there are results to show, we need to generate an entry
  // for each restaurant
  if (numRestaurants > 0) {
    $(".no-results").css("display", "none");

    var restArr = currPageResults[currentPage];
    console.log("restArr is: ", restArr);
    restArr.forEach(function(restaurant) {
      $(".results-list").append(
        "<div class='restaurant-display'>"
          + "<div class='restaurant-header'>"
                + "<a href='" + restaurant.url + "' target='_blank'>"
                + restaurant.name + "</a><img src='" 
                + restaurant.rating_img_url_large
                + "' alt='" + restaurant.rating + " stars' >"
          + "</div>"
          + "<div class='restaurant-info'>"
              + retrieveCategories(restaurant.categories)
        + "</div>"
      );
    });
  }
}

// Helper function
function retrieveCategories(categoryArr) {
  var cleanedCategoryArr = [];
  categoryArr.forEach(function(subCatArr) {
    cleanedCategoryArr.push(subCatArr[0]);
  });

  return cleanedCategoryArr.join(", ");
}

// Populates the results on the map
function populateMap() {
  var restArr = currPageResults[currentPage];

  restArr.forEach(function(result) {
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
    
    var marker = new google.maps.Marker({
      map: map,
      position: resLatLng,
      infowindow: infoWindow,
      cursor: 'pointer'
    });

    restMarkers.push(marker);
    markerDict[result.id] = marker;
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

function filterResults(filter) {
  if (filter != '') {
    var sanitizedFilter = filter.toLowerCase();
    if (sanitizedFilter in restCategories) {
      var filteredRests = Array.from(restCategories[sanitizedFilter]);
      numRestaurants = filteredRests.length;
      currPageResults = createPageResults(filteredRests);

      clearResults();
      displayResults();

    } else {
      $(".results-title").delay(50).text("0 restaurants found");
      $("#filter-category").attr("placeholder", "Filter results here...");
      clearResults();
    }

  // Basically do nothing
  } else {
    $("#filter-category").attr("placeholder", "Filter results here...");
    numRestaurants = totalNumRestaurants;
    currPageResults = pageResults;

    clearResults();
    displayResults();
  }
}

// Clears query value and results
function clearQuery(isOrigin) {
  clearResults();
  dirDisplay.setMap(null);

  if (isOrigin) {
    if (originMarkers !== undefined && originMarkers.length > 0) {
      originMarkers.forEach(function(marker) {
        marker.setMap(null);
      });

      destMarkers[0].setVisible(true);
      originMarkers = [];
    }

  } else {
    if (destMarkers !== undefined && destMarkers.length > 0) {
      destMarkers.forEach(function(marker) {
        marker.setMap(null);
      });
    }

    originMarkers[0].setVisible(true);
    destMarkers = [];
  }

  searchResults = [];
  markerDict = {}, restCategories = {};
  rangeBegin = 1, currentPage = 0;
  swLat = 0, swLng = 0, neLat = 0, neLng = 0;

  $("#left-arrow").hide();
  $("#right-arrow").hide();
}

// Helper function
function clearResults() {
  $(".results-list").empty();

  if (restMarkers !== undefined && restMarkers.length > 0) {
    restMarkers.forEach(function(marker) {
      google.maps.event.clearListeners(marker, 'mouseover');
      google.maps.event.clearListeners(marker, 'mouseout');

      marker.setMap(null);
    });
  }

  restMarkers = [];
}
