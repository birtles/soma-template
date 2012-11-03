function getRepeaterData(repeaterValue, scope) {
	var parts = repeaterValue.match(regex.repeat);
	if (!parts) return;
	var source = parts[2];
	var exp = new Expression(source);
	return exp.getValue(scope);
}

function updateScopeWithRepeaterData(repeaterValue, scope, data) {
	var parts = repeaterValue.match(regex.repeat);
	if (!parts) return;
	var name = parts[1];
	scope[name] = data;
}
function getWatcherValue(exp, newValue) {
	var node = exp.node || exp.attribute.node;
	var watchers = node.template.watchers;
	var nodeTarget = isTextNode(node.element) && node.parent ? node.parent.element : node.element;
	var watcherNode = watchers.get(nodeTarget);
	var watcher = watcherNode ? watcherNode : watchers.get(exp.pattern);
	if (isFunction(watcher)) {
		var watcherValue = watcher(exp.value, newValue, exp.pattern, node.scope, node, exp.attribute);
		if (isDefined(watcherValue)) {
			return watcherValue;
		}
	}
	return newValue;
}

function getValue(data, pathString, accessor, params, isFunc, paramsFound) {
	var pathParts = pathString.split('.');
	var path = data;
	if (pathParts[0] !== "") {
		var i = -1, l = pathParts.length;
		while (++i < l) {
			if (!path) {
				if (data._parent) return getValue(data._parent, pathString, accessor, params, isFunc, paramsFound);
				else return undefined;
			}
			path = path[pathParts[i]];
		}
	}
	if (!path) {
		if (data._parent) return getValue(data._parent, pathString, accessor, params, isFunc, paramsFound);
		else return undefined;
	}
	if (!isFunc) {
		if (!isDefined(path[accessor]) && data._parent) return getValue(data._parent, pathString, accessor, params, isFunc, paramsFound);
		else return path[accessor];
	}
	else {
		var args = [];
		if (isDefined(params)) {
			if (paramsFound) args = paramsFound;
			else {
				var i = -1, l = params.length;
				while (++i < l) {
					var p = params[i];
					if (p.match(regex.quote)) {
						args.push(p.replace(regex.quote, ''));
					}
					else {
						var exp = new Expression(p);
						args.push(exp.getValue(data));
					}
				}
			}
		}
		if (!isFunction(path[accessor])) {
			if (data._parent) return getValue(data._parent, pathString, accessor, params, isFunc, args);
			else return undefined;
		}
		return path[accessor].apply(null, args);
	}
	return undefined;
}

function getExpressionPath(value) {
	var val = value.split('(')[0];
	return val.substr(0, val.lastIndexOf("."));
}

function getExpressionAccessor(value) {
	var val = value.split('(')[0];
	return val.substring(val.lastIndexOf(".")).replace('.', '');
}

function getParamsFromString(value) {
	return trimArray(value.split(regex.params));
}

function getNodeFromElement(element, scope, isRepeaterDescendant) {
	var node = new Node(element, scope);
	node.previousSibling = element.previousSibling;
	node.nextSibling = element.nextSibling;
	var attributes = [];
	for (var attr, name, value, attrs = element.attributes, j = 0, jj = attrs && attrs.length; j < jj; j++) {
		attr = attrs[j];
		if (attr.specified) {
			name = attr.name;
			value = attr.value;
			if (name === settings.attributes.skip) {
				node.skip = (value === "" || value === "true");
			}
			if (!isRepeaterDescendant && name === settings.attributes.repeat) {
				node.repeater = value;
			}
			if (
				hasInterpolation(name + ':' + value) ||
					name === settings.attributes.repeat ||
					name === settings.attributes.show ||
					name === settings.attributes.hide ||
					name === settings.attributes.href ||
					value.indexOf(settings.attributes.cloak) !== -1
				) {
				attributes.push(new Attribute(name, value, node));
			}
		}
	}
	node.attributes = attributes;
	return node;
}

function hasInterpolation(value) {
	var matches = value.match(regex.token);
	return matches && matches.length > 0;
}

function hasContent(value) {
	return regex.content.test(value)
}

function isElementValid(element) {
	if (!element) return;
	var type = element.nodeType;
	if (!element || !type) return false;
	// comment
	if (type === 8) return false;
	// empty text node
	if (type === 3 && !hasContent(element.nodeValue) && !hasInterpolation(element.nodeValue)) return false;
	// result
	return true;
}

function compile(template, element, parent, nodeTarget) {
	if (!isElementValid(element)) return;
	// get node
	var node;
	if (!nodeTarget) {
		node = getNodeFromElement(element, parent ? parent.scope : new Scope());
	}
	else {
		node = nodeTarget;
		node.parent = parent;
	}
	node.template = template;
	// children
	if (node.skip) return;
	var child = element.firstChild;
	while (child) {
		var childNode = compile(template, child, node);
		if (childNode) {
			childNode.parent = node;
			node.children.push(childNode);
		}
		child = child.nextSibling;
	}
	return node;
}

function updateScopeWithData(scope, data) {
	clearScope(scope);
	for (var d in data) {
		scope[d] = data[d];
	}
}

function clearScope(scope) {
	for (var key in scope) {
		if (key.substr(0, 1) !== '_') {
			scope[key] = null;
			delete scope[key];
		}
	}
}
