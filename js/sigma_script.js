'use strict';

// Return an array of all descendents from node with id 'nodeId'
// Modified function from Sigma.js
sigma.classes.graph.addMethod('children', function(nodeId, connectedNodes) {

    var k,
    index = this.outNeighborsIndex[nodeId] || {};
    connectedNodes[nodeId] = sig.graph.nodes(nodeId);

    for (k in index) {
	if (!connectedNodes[k])
	    connectedNodes = sig.graph.children(k, connectedNodes);
    }
    return connectedNodes;    

});

// Return an array of all edges going out from a node with id 'nodeId'
// For use in activating edges
// Modified graph neighbor function from Sigma.js
sigma.classes.graph.addMethod('outEdges', function(nodeId) {
    var k,
    e,
    outgoingEdges = {},
    index = this.outNeighborsIndex[nodeId] || {};

    for (k in index) {
	for (e in this.outNeighborsIndex[nodeId][k]) {
            outgoingEdges[e] = this.edgesIndex[e];
	}
    }
    return outgoingEdges;
});

// This function changes the basic data of a node
// Creates a new node with the new data, then all connected
// edges are moved to the new node before the old one is deleted
sigma.classes.graph.addMethod('changeData', function(nodeId, data) {

    var node = sig.graph.nodes(nodeId),
    newNode = {
	id: data.id,
	data: {
	    ss: data.ss,
	    rep_code: data.rep_code,
	    start: data.start
	},
	color: data.color,
	x: node.x,
	y: node.y,
	size: node.size
    },
    in_index = this.inNeighborsIndex[nodeId] || {},
    out_index = this.outNeighborsIndex[nodeId] || {},
    k,
    e;
    

    if (nodeId == data.id) {
	node.data = newNode.data;
	node.color = data.color;
	return;
    }
    // Add new node
    sig.graph.addNode(newNode);
    
    // Transferring all edges
    // Edges are dropped so edge IDs can be preserved

    // For all nodes with edges pointing to newNode
    for (k in in_index)
	for (e in in_index[k]) {
	    // Remove edge and add new one to newNode
	    sig.graph.dropEdge(e);
	    sig.graph.addEdge({
		id: e,
		source: k,
		target: newNode.id,
		size: edgeSize
	    });
	}
    // For all nodes with edges pointing from newNode
    for (k in out_index)
	for (e in out_index[k]) {
	    // Remove edge and add new one from newNode
	    sig.graph.dropEdge(e);
	    sig.graph.addEdge({
		id: e,
		source: newNode.id,
		target: k,
		size: edgeSize
	    });
	}

    sig.graph.dropNode(nodeId);
    
    sig.refresh();
});

// Simple function to convert a string to a number
function toInt(n){ return Math.round(Number(n)); };

// Sigma variables
var sig = new sigma();
var changedGraph = new sigma.classes.graph();
var cachedGraphs;
var locate_plugin;
var tooltips;
var activeState;
var dragListener;
var select;
var keyboard;
var lasso;
var rectSelect;
var editNodeId;

// Graph settings variable defaults
var heatMode = false;
var draw_edges = true;
var nodeSize = 1;
var arrowSize = 5;
var edgeSize = .1;
var graphWidth = 12;
var graphHeight = 10;
var editor_mode = false;

// Simulation variables
var simIndex = 0;
var cache_length = 0;
var cache_index = -1;
var cache_fetch_size = 100;
var playSim = false;
var speed = 0;
var updatingCache = false;
var input_length = 0;
var stopSimOnReport = false;
var reportRecord = "";
var textFile = null;

// DOM elements
var $download_rep_btn; 
var $play_sim_btn;
var $sim_step_btn;
var $sim_rev_btn;
var $hidden_play_btn;
var $input_display_container;
var $table;

var graph_container;


// Called on page load
function pageLoad() {

    // Initialize DOM element references
    $download_rep_btn = $('#dl-rep-btn');
    $play_sim_btn = $('#play-sim-btn');
    $sim_step_btn = $('#sim-step-btn');
    $sim_rev_btn = $('#sim-rev-btn');
    $hidden_play_btn = $('#hidden-play-btn');
    $input_display_container = $('#input-display-container');
    $table = $("#input-table");

    // Set graph container height to fit between header and footer
    graph_container = document.getElementById("graph-container");
    graph_container.style.top = document.getElementById("click-collapse-bar").offsetHeight + "px";
    graph_container.style.height = "calc(100% - " + document.getElementsByClassName("footer")[0].offsetHeight + "px - " + document.getElementById("click-collapse-bar").offsetHeight + "px)";
    
    /* INPUT LISTENERS */

    // Range sliders
    $('input[type=range]').on('input', function() {
	$(this).trigger('change');
    });
    $('#node-slider').change( function() {
	nodeSizeChange($(this).val());
    });
    $('#edge-slider').change( function() {
	edgeSizeChange($(this).val());
    });
    $('#width-slider').change( function() {
	widthChange($(this).val());
    });
    $('#angle-slider').change( function() {
	rotationChange($(this).val());
    });
    $('#speed-slider').change( function() {
	var val = $(this).val();
	speed = val;
	if (playSim) {
	    $play_sim_btn.html("Play Simulation");
	    $sim_step_btn.prop("disabled", false);
	    $sim_rev_btn.prop("disabled", false);
	    clearInterval(interval);
	    playSim = false;
	}
	if (val == 0)
	    $('#play-speed-text').html("Play Speed: Fastest");
	else if (val >= -.3)
	    $('#play-speed-text').html("Play Speed: Fast");
	else if (val >= -.8)
	    $('#play-speed-text').html("Play Speed: Medium");	
	else if (val >= -1.8)
	    $('#play-speed-text').html("Play Speed: Slow");
	else
	    $('#play-speed-text').html("Play Speed: Slowest");
    });

    // Check boxes
    $('#inhex-mode-box').click(function() {
	$table.find('tr').toggle();
    });
    $('#inheat-mode-box').click(function() {
	toggleHeatMap();
    });
    $('#instop-sim-report-box').click(function() {
	stopSimOnReport = document.getElementById('instop-sim-report-box').checked;
    });

    // Buttons
    $('#reset-camera-btn').click(function() {
	resetCamera();
    });
    $('#toggle-lasso-btn').click(function() {
	toggleLasso();
    });
    $('#toggle-rect-btn').click(function() {
	toggleRect();
    });
    $sim_step_btn.click(function() {
	stepFromCache(1).then(function(response) {
	    $sim_rev_btn.prop("disabled", false);
	    $input_display_container.animate({scrollLeft: simIndex % 1000 * 30 - $(window).width()/2}, 300);
	    if (simIndex == cache_index)
		$sim_step_btn.prop("disabled", true);
	}, function(reject) {
	    console.log(reject);
	});
    });
    $sim_rev_btn.prop("disabled", true);
    $sim_rev_btn.click(function() {
	stepFromCache(-1).then(function(response) {
	    $sim_step_btn.prop("disabled", false);
	    $play_sim_btn.prop("disabled", false);
	    $input_display_container.animate({scrollLeft: simIndex % 1000 * 30 - $(window).width()/2}, 300);
	    if (simIndex + cache_length - cache_index - 1 == 0)
		$sim_rev_btn.prop("disabled", true);		
	}, function(reject) {
	    console.log(reject);
	});
	
    });
    $hidden_play_btn.click(function(){
	stepFromCache(1).then(function(resolve) {
	    $input_display_container.animate({scrollLeft: simIndex % 1000 * 30 - $(window).width()/2}, 0);
	}, function(reject) {
	    //console.log(reject);
	    clearInterval(interval);
	    playSim = false;
	    if (reject == "stop on report") 
		$sim_step_btn.prop("disabled", false);
	    $sim_rev_btn.prop("disabled", false);
	    $play_sim_btn.html("Play Simulation");
	});

    });
    var interval = null;
    $play_sim_btn.click(function() {
	playSim ^= true;
	if (playSim) {
	    $play_sim_btn.html("Stop Simulation <span class='glyphicon glyphicon-pause' aria-hidden='true'></span>");
	    $sim_step_btn.prop("disabled", true);
	    $sim_rev_btn.prop("disabled", true);
	}
	else {
	    $play_sim_btn.html("Play Simulation <span class='glyphicon glyphicon-play' aria-hidden='true'></span>");
	    $sim_step_btn.prop("disabled", false);
	    $sim_rev_btn.prop("disabled", false);
	    clearInterval(interval);
	    return;
	}
	interval = setInterval(function() {
	    $hidden_play_btn.click();
	}, speed*-1000 + 1);

    });

    // Sigma instance
    sig = new sigma({
	renderer: {
	    container: document.getElementById('graph-container')
	    // Allows for alpha channel and self-loops; uses WebGL if possible, canvas otherwise
	    // type: 'webgl'
	},
	settings: {
	    skipIndexation: true,
	    labelThreshold: 100,
	    hideEdgesOnMove: true,
	    zoomMin: .00001,
	    zoomMax: 2,
	    edgeColor: "default",
	    drawEdges: draw_edges,
	    drawEdgeLabels: false,
	    edgeHoverColor: "default",
	    edgeHoverSizeRatio: 2,
	    edgeHoverExtremities: true,
	    defaultEdgeColor: "#888",
	    defaultEdgeType: "arrow",
	    defaultNodeType: "fast",
	    maxNodeSize: nodeSize,
	    minNodeSize: 0,
	    minEdgeSize: 0,
	    maxEdgeSize: edgeSize,
	    nodesPowRatio: 1,
	    edgesPowRatio: 1,
	    sideMargin: 5,
	    borderSize: 2,
	    nodeQuadTreeMaxLevel: 8,
	    edgeQuadTreeMaxLevel: 8,
	    // Plugin stuff
	    enableEdgeHovering: false,
	    edgeHoverHighlightNodes: 'circle',
	    mouseEnabled: true,
	    touchEnabled: true,
	    defaultNodeActiveBorderColor: '#ff7',
	    nodeBorderSize: 0,
	    nodeActiveBorderSize: 2
	}
    });

    // Linkurious plugins
    locate_plugin = sigma.plugins.locate(sig);

    var config = {
	node: [ 
	    {
		show: 'rightClickNode',
		cssClass: 'sigma-tooltip',
		position: 'right',
		template:
		'<ul class="custom-menu">' +
		    '<div class="hover-info"><p>ID: {{id}}</p>' +
		    '<p>Symbol Set: {{data.ss}}</p>' +
		    '<p>{{data.start}}</p>' +
		    '<p>{{data.rep_code}}</p></div>' +
		    '<li onClick="toggleChildren(\'{{id}}\')">Show/Hide Children</li>' +
		    '<li onClick="soloChildren(\'{{id}}\')">Solo Children</li>' +
		    '<li onClick="printNodeData(\'{{id}}\')">- Print Node Data -</li>' +
		    '</ul>',
		renderer: function(node, template) {
		    return Mustache.render(template, node);
		}
	    }
	],
	stage: {
	    template:
	    '<ul class="custom-menu">' +
		'<li onClick="openSearchBar()">Search By ID</li>' +
		'<li onClick="showAllNodes()">Show All Nodes</li>' +
		'<li onClick="toggleEditorMode()">Toggle Editor Mode</li>' +
		'<li onClick="resetCamera()">Reset Camera</li>' +
		'</ul>'
	}
    };
    tooltips = sigma.plugins.tooltips(sig, sig.renderers[0], config);

    sig.bind('clickStage', function() {tooltips.close()});

    sig.refresh();
    
}

function resetSimulation() {
    simIndex = 0;
    cache_length = 0;
    cache_index = -1;
    cache_fetch_size = 100;
    playSim = false;
    updatingCache = false;
    cachedGraphs = {};
    changedGraph.clear();
    reportRecord = "";
    $download_rep_btn.hide();
    textFile = null;
    $table = $('#input-table');
    $('#angle-slider').val(0);
    graph_container.style.height = "calc(100% - " + document.getElementsByClassName("footer")[0].offsetHeight + "px - " + document.getElementById("click-collapse-bar").offsetHeight + "px)";
}

function setInputLength(length) {
    input_length = length;
}

function makeTextFile() {
    var data = new Blob([reportRecord], {type: 'text/plain'});

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
	window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);

    return textFile;
}

function setCachedGraphs(index, json_object) {
    var prevIndex = cache_index,
    i,
    k;
    // Reset clickability of previous graphs
    $('a.click-index').contents().unwrap();
    
    cachedGraphs = json_object;
    cache_length = cachedGraphs[0].length;
    cache_index = index;
    updatingCache = false;
    
    // Make new range of cache clickable
    $table.find('tr').each(function(index, row) {
	$(row).find('td').slice(cache_index - cache_length + 1, cache_index + 1).children().each(function(i, e) {
	    $(e).wrap("<a href='#' onClick='indexClick(" + (cache_index - cache_length + i + 1) + ")'></a>");
	});
    });
    // Update report record and character stream to reflect reports
    for (i = cache_length - cache_index + prevIndex; i<cache_length; i++) {
	// Add reporting nodes to record
	if (cachedGraphs[0][i]["rep_nodes"].length != 0) {
	    $download_rep_btn.show();
	    var abs_i = cache_index - cache_length + i + 1;

	    reportRecord += "Reporting on '" + cachedGraphs[0][i].symbol + "' @cycle " + abs_i + ":\n";
	    var reports = "";
	    var rep_length = cachedGraphs[0][i]["rep_nodes"].length;
	    for (k = 0; k < rep_length; k++) {
		var node = cachedGraphs[0][i]["rep_nodes"][k]; 
		reportRecord += "\tid: " + node.id + "  report code: " + node.rep_code + "\n";
		reports += "<p>" + node.id + ": " + node.rep_code + "</p>";
	    }

	    // Loading UTF and hex row with data

	    $table.find('tr').each(function(i, e) {
		var cell = $(e).find('td').eq(abs_i);
		cell.attr("data-toggle", "popover");
		cell.attr("title", "Reporting STEs @" + abs_i);
		cell.attr("data-content", reports);
		cell.attr("data-trigger", "hover focus");
		cell.attr("data-container", "body");
		cell.attr("data-placement", "top");
		cell.attr("data-html", "true");
		cell.addClass("report");
	    });
	    $('[data-toggle="popover"]').popover();
	}	
    }
    
    $download_rep_btn.attr({href: makeTextFile()});
    
    // Enable forward sim buttons
    if (!playSim)
	$sim_step_btn.prop("disabled", false);
    $play_sim_btn.prop("disabled", false);

}

function indexClick(index) {
    
    // Disable/enable sim buttons
    if (index == cache_index) { // end of cache; disable moving forward 
	$sim_step_btn.prop("disabled", true);
	$play_sim_btn.prop("disabled", true);
    }
    else { // otherwise enable
	$sim_step_btn.prop("disabled", false);
	$play_sim_btn.prop("disabled", false);
    }
    if (index == cache_index - cache_length + 1) // beginning of cache; disable moving back
	$sim_rev_btn.prop("disabled", true);
    else // otherwise enable
	$sim_rev_btn.prop("disabled", false);

    stepFromCache(index - simIndex);

}

function loadGraph(json_object){

    nodeSizeChange($('#node-slider').val());    
    edgeSizeChange($('#edge-slider').val());
    widthChange($('#width-slider').val());
     
    $download_rep_btn.hide();

    try {
	sig.graph.clear();
	sig.refresh();
    } catch (e) {
	console.log("Error clearing graph: " + e.message);
    }
    try {
	sig.cameras[0].goTo({angle: 0});
	sig.graph.read(json_object);
	
	// Set sizes and save color of nodes

	sig.graph.nodes().forEach(function(n) {
	    n.size = 1;
	    n.originalColor = n.color;
	    n.x = n.x * Math.pow(1.1, graphWidth);
	    n.y = ~~n.y;
	    n.count = 0;
	    if (heatMode)
		n.color = "rgb(0,0,0)";
	});
	sig.graph.edges().forEach(function(e) {
	    e.size = 0.05;
	});

	sig.refresh();
	$('#loading-graph-modal').modal('hide');
    } catch (err) {
	$('#loading-graph-modal').modal('hide');
	alert(err.message);
    }
    
}

function stepFromCache(step_size) {
    return new Promise(function(resolve, reject) {
	var relativeIndex = simIndex + cache_length - cache_index - 1 + step_size;
	if (relativeIndex >= cache_length || relativeIndex < 0) {
	    if (updatingCache)
		resolve("updating cache...continue simulation");
	    else
		reject("End of cache reached");
	    return;
	}
	// Setting table cells to reflect changed simIndex
	if (simIndex >= 0)
	    $table.find('tr').find('td:eq(' + simIndex + ')').removeClass("highlight");
	 
	simIndex += step_size;
	$('#cycle-index-text').html("" + simIndex);
	
	$table.find('tr').find('td:eq(' + simIndex + ')').addClass("highlight");
	updateGraph(cachedGraphs[0][relativeIndex]);

	if (stopSimOnReport && cachedGraphs[0][relativeIndex]["rep_nodes"].length > 0)
	    reject("stop on report");
	else	    
	    resolve("Loaded graph");

	// Cache reloading
	if (!updatingCache && cache_index != input_length - 1 && cache_index - simIndex <= .25 * cache_fetch_size) {
	    updatingCache = true;
	    $('#hidden-cache-btn').click();	   
	}
    });
}

function updateGraph(updateJson) {
    // Revert the colors of all previously updated nodes and 
    //console.log(JSON.stringify(updateJson));
    var timer = new Date().getTime();
    if (!heatMode) {
	changedGraph.nodes().forEach(function (n) {
	    sig.graph.nodes(n.id).color = n.originalColor;
	});
	changedGraph.edges().forEach(function (e) {
	    sig.graph.edges(e.id).color = "";
	});
    }
    /*
      else {
      changeGraph.nodes().forEach(function (n) {
      var node = sig.graph.nodes(n.id);
      node.color = "rgb(" + toInt(255 - 255/(node.count+1)) + "," + Math.min(node.count, 255) + ",0)";
      });
      }*/
    changedGraph.clear();
    
    var changedNodesArray = updateJson.nodes;
    // Make an array of node IDs from incoming data
    var changedNodeIDs = [];
    for (var i = 0; i < changedNodesArray.length; i++)
	changedNodeIDs[i] = changedNodesArray[i].id;
    // Get array containing references to actual graph nodes
    var sigmaNodes = sig.graph.nodes(changedNodeIDs);
    // Add these nodes to changedGraph nodes
    for (var i = 0; i < sigmaNodes.length; i++)
	changedGraph.addNode(sigmaNodes[i]);
    for (var i = 0; i < sigmaNodes.length; i++) {
	// Update count only if it is higher than before -- no backwards traversal for heat map
	sigmaNodes[i].count = Math.max(parseInt(changedNodesArray[i].count), sigmaNodes[i].count);
	if (heatMode) 
	    sigmaNodes[i].color = "rgb(" + toInt(255 - 255/(sigmaNodes[i].count+1)) + "," + Math.min(sigmaNodes[i].count, 255) + ",0)";
	else
	    sigmaNodes[i].color = changedNodesArray[i].color;
	// If node is activated, light up outgoing edges
	if (sigmaNodes[i].color == "rgb(0,255,0)" && !heatMode) {
	    var outgoingEdges = sig.graph.outEdges(sigmaNodes[i].id),
	    e;
	    for (e in outgoingEdges) {
		outgoingEdges[e].color = "#0f0";
		try {
		    changedGraph.addEdge(outgoingEdges[e]);
		} catch (error) {
		    console.log(error);
		    console.log(outgoingEdges[e]);
		}
	    }
	}
    }
    sig.refresh({skipIndexation: true});
    console.log("update graph timer: " + (new Date().getTime() - timer));
}

// Graph manipulation controls

function nodeSizeChange(val) {
    nodeSize = .1 * Math.pow(1.1, val);
    if (editor_mode)
	sig.graph.nodes().forEach(function (n) {
	    n.size = nodeSize;
	});
    sig.settings('maxNodeSize', nodeSize);
    sig.settings('zoomMin', nodeSize/80);
    sig.refresh({skipIndexation: true});
}

function edgeSizeChange(val) {
    edgeSize = .005 * Math.pow(1.2, val);
    if (editor_mode)
	sig.graph.edges().forEach(function (e) {
	    e.size = edgeSize;
	});
    sig.settings('maxEdgeSize', edgeSize);
    sig.refresh({skipIndexation: true});
}

function widthChange(val) {
    var ratio = Math.pow(1.1, val - graphWidth);
    sig.graph.nodes().forEach(function (n) {
	n.x *= ratio;
    });
    graphWidth = val;
    sig.refresh();
}

function rotationChange(val) {
    sig.cameras[0].goTo({angle: -1 * Math.PI / 180 * parseInt(val)});
    sig.refresh();
}

function toggleEdges() {
    if ($('#inrender-edge-box').is(':checked'))
	sig.settings("drawEdges", true);
    else 
	sig.settings("drawEdges", false);

    $('#edge-slider').toggle('disabled');
    draw_edges ^= true;
    sig.refresh({skipIndexation: true});
}

function toggleHeatMap() {
    if ($('#inheat-mode-box').is(':checked')) {
	heatMode = true;
	sig.graph.nodes().forEach(function (n) {
	    n.color = "rgb(" + toInt(255 - 255/(n.count+1)) + "," + Math.min(n.count, 255) + ",0)";
	    //console.log(n.color);
	});
	sig.graph.edges().forEach(function (e) {
	    e.color = "#888";
	});
    }
    else {
	heatMode = false;
	sig.graph.nodes().forEach(function (n) {
	    n.color = n.originalColor;
	});
    }

    sig.refresh({skipIndexation: true});
}

function openSearchBar() {
    tooltips.close();
    $('#search-modal').modal('show');
}

function resetCamera() {
    tooltips.close();
    sigma.misc.animation.camera(
	sig.cameras[0],
	{ ratio: 1, x: 0, y: 0, angle: 0 },
	{ duration: 150 }
    );
    console.log(sig.cameras[0]);
    $('#angle-slider').val(0);
}

function toggleChildren(nodeId) {
    tooltips.close();
    toKeep = sig.graph.children(nodeId, {});

    var hidden = true,
    k;
    // If any are visible, hide all; else show all
    for (k in toKeep)
	if (!toKeep[k].hidden && k != nodeId) {
	    hidden = false;
	    break;
	}
 
    sig.graph.nodes().forEach(function(n) {
	if (toKeep[n.id] && nodeId !=  n.id)
	    n.hidden = !hidden;
    });

    sig.refresh({skipIndexation: true});

}

function soloChildren(nodeId) {
    tooltips.close();
    toKeep = sig.graph.children(nodeId, {});
    toKeep[nodeId] = sig.graph.nodes(nodeId);
 
    sig.graph.nodes().forEach(function(n) {
	if (toKeep[n.id])
	    n.hidden = false;
	else
	    n.hidden = true;
    });

    sig.refresh({skipIndexation: true});

}

function showAllNodes() {
    tooltips.close();
    sig.graph.nodes().forEach(function(n) {
	n.hidden = false;
    });

    sig.refresh({skipIndexation: true});
}

function toggleLasso() {
    if (lasso.isActive) 
	lasso.deactivate();
    else
	lasso.activate();
}

function toggleRect() {
    if (rectSelect.isActive) 
	rectSelect.stop();
    else
	rectSelect.start();
}

function searchById() {

    var bar = document.getElementById("search-bar");
    locate_plugin.nodes(bar.value);
    bar.value = "";
    
    sig.refresh({skipIndexation: true});
    
}

function printNodeData(nodeId) {
    tooltips.close();
    /* DON'T REMOVE THIS */ console.log(sig.graph.nodes(nodeId));
}

function appendOptimizations(opt) {
    if (~window.location.href.indexOf("?a=")) {
	var path = window.location.href.substring(window.location.href.indexOf("?a="));
	window.history.pushState({}, 'Title', path + opt);
    }
}

function toggleEditorMode() {
    tooltips.close();

    /* Start Editor mode */
    if (!editor_mode) {
	editor_mode = true;
	// Set background of the graph container
	graph_container.style.backgroundColor = "#ffd";
	// Show Editor Tab and hide Simulation Tools
	$('#editor-tab').show();
	$('#editor-tab').addClass('active');
	$('#editor-tools').show();
	
	$('#graph-settings').hide();
	$('#graph-tab').removeClass('active');
	$('#sim-tab').hide();
	$('#sim-tools').hide();
	$('#sim-tab').removeClass('active');

	// Appropriately display nodes and edges without autoscaling
	var cam = sig.cameras[0];
	var camSettings = {x: cam.x, y: cam.y, ratio: cam.ratio, angle: cam.angle};
	sig.graph.nodes().forEach(function(n) {
	    n.size = nodeSize * cam.ratio;
	    n.hidden = false;
	});
	sig.graph.edges().forEach(function(e) {
	    e.size = edgeSize / cam.ratio;
	});
	
	// Switch to Canvas renderer
	sig.killRenderer(sig.renderers[0]);
	sig.killCamera(sig.cameras[0]);
	sig.addRenderer({
	    container: document.getElementById('graph-container'),
	    type: 'canvas'
	});
	sig.cameras[0].goTo(camSettings);
	// Turn off autoRescale because it's annoying when moving nodes
	sig.settings('autoRescale', false);
	// Enable edge hovering to allow user to delete connections
	sig.settings('enableEdgeHovering', true);

	// Instantiate plug-ins
	var renderer = sig.renderers[0];
	activeState = sigma.plugins.activeState(sig);
	dragListener = sigma.plugins.dragNodes(sig, renderer, activeState);
	select = sigma.plugins.select(sig, activeState, renderer);
	keyboard = sigma.plugins.keyboard(sig, renderer);
	select.bindKeyboard(keyboard);
	lasso = new sigma.plugins.lasso(sig, renderer, {
	    strokeStyle: 'red',
	    fillWhileDrawing: true
	});
	select.bindLasso(lasso);
	rectSelect = new sigma.plugins.rectSelect(sig, renderer);
	select.bindRect(rectSelect);

	// Change tooltip menu to edit features
	sigma.plugins.killTooltips(sig);
	var config = {
	    node: [ 
		{
		    show: 'rightClickNode',
		    cssClass: 'sigma-tooltip',
		    position: 'right',
		    template:
		    '<ul class="custom-menu">' +
			'<div class="hover-info"><p>ID: {{id}}</p>' +
			'<p>Symbol Set: {{data.ss}}</p>' +
			'<p>{{data.start}}</p>' +
			'<p>{{data.rep_code}}</p></div>' +
			'<li onClick="addEdge(\'{{id}}\')">Add Outgoing Connection</li>' +
			'<li onClick="triggerChangeData(\'{{id}}\')">Change Data</li>' +
			'<li onClick="deleteSTE(\'{{id}}\')">Delete STE</li>' +
			'</ul>',
		    renderer: function(node, template) {
			return Mustache.render(template, node);
		    }
		}
	    ],
	    edge: {
		show: 'rightClickEdge',
		template: 'Clicked edge!'
	    },
	    stage: {
		template:
		'<ul class="custom-menu">' +
		    '<li onClick="triggerAddSTE(event)">Add STE</li>' +		 
		    '<li onClick="showAllNodes()">Show All Nodes</li>' +
		    '<li onClick="toggleEditorMode()">Toggle Editor Mode</li>' +
		    '<li onClick="resetCamera()">Reset Camera</li>' +
		    '</ul>'
	    }
	};
	tooltips = sigma.plugins.tooltips(sig, sig.renderers[0], config);


	sig.refresh();

    }
    /* End Editor Mode */
    else {
	editor_mode = false;
	// Revert background color
	graph_container.style.backgroundColor = "#fff";

	// Toggle tabs
	$('#editor-tab').hide();
	$('#editor-tab').removeClass('active');
	$('#editor-tools').hide();
	
	$('#graph-settings').show();
	$('#graph-tab').addClass('active');
	$('#sim-tab').show();

	// Kill editor plugins
	sigma.plugins.killDragNodes(sig);
	sigma.plugins.killActiveState();
	sigma.plugins.killSelect(sig);
	
	// Revert Tooltip menu
	sigma.plugins.killTooltips(sig);
	var config = {
	    node: [ 
		{
		    show: 'rightClickNode',
		    cssClass: 'sigma-tooltip',
		    position: 'right',
		    template:
		    '<ul class="custom-menu">' +
			'<div class="hover-info"><p>ID: {{id}}</p>' +
			'<p>Symbol Set: {{data.ss}}</p>' +
			'<p>{{data.start}}</p>' +
			'<p>{{data.rep_code}}</p></div>' +
			'<li onClick="toggleChildren(\'{{id}}\')">Show/Hide Children</li>' +
			'<li onClick="soloChildren(\'{{id}}\')">Solo Children</li>' +
			'<li onClick="printNodeData(\'{{id}}\')">- Print Node Data -</li>' +
			'</ul>',
		    renderer: function(node, template) {
			return Mustache.render(template, node);
		    }
		}
	    ],
	    stage: {
		template:
		'<ul class="custom-menu">' +
		    '<li onClick="openSearchBar()">Search By ID</li>' +
		    '<li onClick="showAllNodes()">Show All Nodes</li>' +
		    '<li onClick="toggleEditorMode()">Toggle Editor Mode</li>' +
		    '<li onClick="resetCamera()">Reset Camera</li>' +
		    '</ul>'
	    }
	};
	tooltips = sigma.plugins.tooltips(sig, sig.renderers[0], config);


	// Switch to WebGL renderer
	sig.killRenderer(sig.renderers[0]);
	sig.killCamera(sig.cameras[0]);
	sig.addRenderer({
	    container: document.getElementById('graph-container')
	});

	// Turn autoRescale back on
	sig.settings('autoRescale', true);
	// Turn edge hovering off
	sig.settings('enableEdgeHovering', false);


	sig.refresh();

    }
    
}

// Editor Functions

function triggerAddSTE() {
    tooltips.close();
    $('#add-ste-modal').modal('show');
}

function addSTE(id, ss, rep_code, start, color) {
    $('#add-ste-modal').modal('hide');

    console.log(color);
    var newNode = {
	id: id,
	x: 0,
	y: 0,
	size: nodeSize,
	color: color,
	data: {
	    ss: ss,
	    rep_code: rep_code,
	    start: start
	}
    };

    dragListener.addNode(newNode);
    
    sig.refresh();
    

}

function addEdge(sourceId) {
    tooltips.close();
    
    dragListener.addEdge(sourceId, edgeSize);
    select.addEdge(sourceId, edgeSize);
}

function triggerChangeData(nodeId) {
    tooltips.close();
    var node = sig.graph.nodes(nodeId),
    start = (node.data.start) ? node.data.start.substring(12) : "none",
    rep = (node.data.rep_code) ? node.data.rep_code.substring(13) : "";
    editNodeId = nodeId;

    Wt.emit(Wt, "changeSTEData", node.id, node.data.ss, start, rep);
}

function updateSTEData(id, ss, start, rep, color) {
    $('#add-ste-modal').modal('hide');
    var data = {
	id: id,
	ss: ss,
	start: start,
	rep_code: rep,
	color: color
    };
    sig.graph.changeData(editNodeId, data);

}
