(function() {
  var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  Annotator.Plugin.Filter = (function(superClass) {
    extend(Filter, superClass);

    Filter.prototype.events = {
      ".annotator-filter-property input focus": "_onFilterFocus",
      ".annotator-filter-property input blur": "_onFilterBlur",
      ".annotator-filter-property input keyup": "_onFilterKeyup",
      ".annotator-filter-property input[type='checkbox'] change": "_onBooleanFilterChange",
      ".annotator-filter-previous click": "_onPreviousClick",
      ".annotator-filter-next click": "_onNextClick",
      ".annotator-filter-clear click": "_onClearClick"
    };

    Filter.prototype.classes = {
      active: 'annotator-filter-active',
      hl: {
        hide: 'annotator-hl-filtered',
        active: 'annotator-hl-active'
      }
    };

    Filter.prototype.html = {
      element: "<div class=\"annotator-filter\"></div>",
      navigation: "<span class=\"annotator-filter-navigation-wrapper\">\n    <strong>" + Annotator._t('Navigate:') + "</strong>\n<span class=\"annotator-filter-navigation\">\n   <button class=\"annotator-filter-previous\">" + Annotator._t('Previous') + "</button>\n<button class=\"annotator-filter-next\">" + Annotator._t('Next') + "</button>\n    </span>\n</span>",
      filterBy: "<strong>" + Annotator._t('Filter by:') + "</strong>",
      filter: "<span class=\"annotator-filter-property\">\n  <label></label>\n  <input/>\n  <button class=\"annotator-filter-clear\">" + Annotator._t('Clear') + "</button>\n</span>",
      filterBoolean: "<span class=\"annotator-filter-property filter-boolean\">\n  <label>\n\n   </label>\n   <input type='checkbox'/>\n</span>"
    };

    Filter.prototype.options = {
      appendTo: 'body',
      insertSpacer: true,
      showNavigation: true,
      showFilterByLabel: true,
      filters: [],
      addAnnotationFilter: true,
      keyUpDebounce: 300,
      idPrefix: '',
      isFiltered: function(input, property, isBoolean) {
        var i, keyword, len, propertyLowerCase, ref;
        if (isBoolean) {
          return !!input === !!property;
        }
        if (!(input && property)) {
          return false;
        }
        propertyLowerCase = property.toLowerCase();
        ref = input.toLowerCase().split(/\s+/);
        for (i = 0, len = ref.length; i < len; i++) {
          keyword = ref[i];
          if (propertyLowerCase.indexOf(keyword) === -1) {
            return false;
          }
        }
        return true;
      }
    };

    function Filter(element, options) {
      this._onPreviousClick = bind(this._onPreviousClick, this);
      this._onNextClick = bind(this._onNextClick, this);
      this._onBooleanFilterChange = bind(this._onBooleanFilterChange, this);
      this._onFilterKeyup = bind(this._onFilterKeyup, this);
      this._onFilterBlur = bind(this._onFilterBlur, this);
      this._onFilterFocus = bind(this._onFilterFocus, this);
      this.updateHighlights = bind(this.updateHighlights, this);
      this.publishFilteredEvent = bind(this.publishFilteredEvent, this);
      this.updateFilters = bind(this.updateFilters, this);
      var base;
      element = $(this.html.element).appendTo((options != null ? options.appendTo : void 0) || this.options.appendTo);
      Filter.__super__.constructor.call(this, element, options);
      (base = this.options).filters || (base.filters = []);
      this.filter = $(this.html.filter);
      this.filterBoolean = $(this.html.filterBoolean);
      this.filters = [];
      this.current = 0;
      this.debouncedOnFilterKeyUp = this.debounce(function(event) {
        var filter;
        filter = $(event.target).parent().data('filter');
        if (filter) {
          return this.updateFilter(filter);
        }
      }, this.options.keyUpDebounce);
    }

    Filter.prototype.pluginInit = function() {
      var filter, i, len, ref;
      if (this.options.showNavigation) {
        $(this.html.navigation).appendTo(this.element);
      }
      if (this.options.showFilterByLabel) {
        $(this.html.filterBy).appendTo(this.element);
      }
      ref = this.options.filters;
      for (i = 0, len = ref.length; i < len; i++) {
        filter = ref[i];
        this.addFilter(filter);
      }
      this.updateHighlights();
      this._setupListeners();
      if (this.options.insertSpacer) {
        this._insertSpacer();
      }
      if (this.options.addAnnotationFilter === true) {
        return this.addFilter({
          label: Annotator._t('Annotation'),
          property: 'text'
        });
      }
    };

    Filter.prototype.destroy = function() {
      var currentMargin, html;
      Filter.__super__.destroy.apply(this, arguments);
      html = $('html');
      currentMargin = parseInt(html.css('padding-top'), 10) || 0;
      html.css('padding-top', currentMargin - this.element.outerHeight());
      return this.element.remove();
    };

    Filter.prototype._insertSpacer = function() {
      var currentMargin, html;
      html = $('html');
      currentMargin = parseInt(html.css('padding-top'), 10) || 0;
      html.css('padding-top', currentMargin + this.element.outerHeight());
      return this;
    };

    Filter.prototype._setupListeners = function() {
      var delayedUpdateHighlights, event, events, i, len, plugin;
      events = ['annotationsLoaded', 'annotationCreated', 'annotationUpdated', 'annotationDeleted'];
      plugin = this;
      delayedUpdateHighlights = function() {
        return setTimeout(plugin.updateFilters, 2);
      };
      for (i = 0, len = events.length; i < len; i++) {
        event = events[i];
        this.annotator.subscribe(event, delayedUpdateHighlights);
      }
      return this;
    };

    Filter.prototype.addFilter = function(options) {
      var f, filter, inputElement;
      filter = $.extend({
        label: '',
        property: '',
        isFiltered: this.options.isFiltered,
        isBoolean: false,
        isAlwaysActive: false,
        enabled: true
      }, options);
      if (filter.enabled) {
        if (!((function() {
          var i, len, ref, results;
          ref = this.filters;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            f = ref[i];
            if (f.property === filter.property && f.isBoolean === filter.isBoolean) {
              results.push(f);
            }
          }
          return results;
        }).call(this)).length) {
          filter.id = this.options.idPrefix + 'annotator-filter-' + filter.property;
          if (filter.isBoolean) {
            filter.id += '-boolean';
          }
          if (filter.name) {
            filter.id += '-' + filter.name;
          }
          filter.annotations = [];
          if (filter.isBoolean) {
            filter.element = this.filterBoolean.clone().appendTo(this.element);
          } else {
            filter.element = this.filter.clone().appendTo(this.element);
          }
          filter.element.find('label').html(filter.label).attr('for', filter.id);
          inputElement = filter.element.find('input');
          inputElement.attr({
            id: filter.id
          });
          if (!filter.isBoolean) {
            inputElement.attr({
              placeholder: Annotator._t('Filter by ') + filter.label + '\u2026'
            });
            filter.element.find('button').hide();
          }
          filter.element.data('filter', filter);
          this.filters.push(filter);
        }
      }
      return this;
    };

    Filter.prototype.updateFilter = function(filter) {
      var changed, oldVal;
      this.updateHighlights();
      this.resetHighlights();
      oldVal = filter.currentInputVal;
      this.updateFilterState(filter);
      changed = filter.currentInputVal !== oldVal;
      if (changed) {
        this.filterHighlights();
        return this.publishFilteredEvent();
      }
    };

    Filter.prototype.updateFilterState = function(filter) {
      var annotation, annotations, i, input, inputElement, len, property, ref, results;
      filter.annotations = [];
      inputElement = filter.element.find('input');
      if (filter.isBoolean) {
        input = inputElement.is(":checked");
      } else {
        input = $.trim(inputElement.val());
      }
      filter.isActive = filter.isAlwaysActive || !!input;
      filter.currentInputVal = input;
      if (filter.isActive) {
        annotations = this.highlights.map(function() {
          return $(this).data('annotation');
        });
        ref = $.makeArray(annotations);
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          annotation = ref[i];
          property = annotation[filter.property];
          if (filter.isFiltered(input, property, filter.isBoolean)) {
            results.push(filter.annotations.push(annotation));
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };

    Filter.prototype.updateFilters = function() {
      var filter, i, len, ref;
      this.updateHighlights();
      this.resetHighlights();
      ref = this.filters;
      for (i = 0, len = ref.length; i < len; i++) {
        filter = ref[i];
        this.updateFilterState(filter);
      }
      return this.filterHighlights();
    };

    Filter.prototype.publishFilteredEvent = function() {
      var activeFilters, af, f, i, len;
      activeFilters = $.grep(this.filters, function(filter) {
        return filter.isActive;
      });
      if (!activeFilters) {
        activeFilters = [];
      }
      af = [];
      for (i = 0, len = activeFilters.length; i < len; i++) {
        f = activeFilters[i];
        af.push({
          name: f.name,
          property: f.property,
          value: f.currentInputVal
        });
      }
      this.annotator.publish('annotationsFiltered', [af]);
      return this;
    };

    Filter.prototype.updateHighlights = function() {
      this.highlights = this.annotator.element.find('.annotator-hl:visible');
      return this.filtered = this.highlights.not(this.classes.hl.hide);
    };

    Filter.prototype.filterHighlights = function() {
      var activeFilters, annotation, filtered, highlights, i, index, len, ref;
      activeFilters = $.grep(this.filters, function(filter) {
        return filter.isActive;
      });
      if (!activeFilters.length) {
        return this;
      }
      filtered = ((ref = activeFilters[0]) != null ? ref.annotations : void 0) || [];
      if (activeFilters.length > 1) {
        filtered = this.intersection(activeFilters.map(function(f) {
          return f.annotations;
        }));
      }
      console.log(filtered);
      highlights = this.highlights;
      for (index = i = 0, len = filtered.length; i < len; index = ++i) {
        annotation = filtered[index];
        highlights = highlights.not(annotation.highlights);
      }
      highlights.addClass(this.classes.hl.hide);
      this.filtered = this.highlights.not(this.classes.hl.hide);
      return this;
    };

    Filter.prototype.resetHighlights = function() {
      this.highlights.removeClass(this.classes.hl.hide);
      this.filtered = this.highlights;
      return this;
    };

    Filter.prototype._onFilterFocus = function(event) {
      var input;
      input = $(event.target);
      input.parent().addClass(this.classes.active);
      return input.next('button').show();
    };

    Filter.prototype._onFilterBlur = function(event) {
      var input;
      if (!event.target.value) {
        input = $(event.target);
        input.parent().removeClass(this.classes.active);
        return input.next('button').hide();
      }
    };

    Filter.prototype._onFilterKeyup = function(event) {
      return this.debouncedOnFilterKeyUp(event);
    };

    Filter.prototype._onBooleanFilterChange = function(event) {
      var filter, input, inputVal;
      input = $(event.target);
      filter = input.parent().data('filter');
      inputVal = input.is(":checked");
      if (!inputVal) {
        input.parent().removeClass(this.classes.active);
      }
      if (filter) {
        return this.updateFilter(filter);
      }
    };

    Filter.prototype._findNextHighlight = function(previous) {
      var active, annotation, current, index, next, offset, operator, resetOffset;
      if (!this.highlights.length) {
        return this;
      }
      offset = previous ? 0 : -1;
      resetOffset = previous ? -1 : 0;
      operator = previous ? 'lt' : 'gt';
      active = this.highlights.not('.' + this.classes.hl.hide);
      current = active.filter('.' + this.classes.hl.active);
      if (!current.length) {
        current = active.eq(offset);
      }
      annotation = current.data('annotation');
      index = active.index(current[0]);
      next = active.filter(":" + operator + "(" + index + ")").not(annotation.highlights).eq(resetOffset);
      if (!next.length) {
        next = active.eq(resetOffset);
      }
      return this._scrollToHighlight(next.data('annotation').highlights);
    };

    Filter.prototype._onNextClick = function(event) {
      return this._findNextHighlight();
    };

    Filter.prototype._onPreviousClick = function(event) {
      return this._findNextHighlight(true);
    };

    Filter.prototype._scrollToHighlight = function(highlight) {
      highlight = $(highlight);
      this.highlights.removeClass(this.classes.hl.active);
      highlight.addClass(this.classes.hl.active);
      return $('html, body').animate({
        scrollTop: highlight.offset().top - (this.element.height() + 20)
      }, 150);
    };

    Filter.prototype._onClearClick = function(event) {
      return $(event.target).prev('input').val('').keyup().blur();
    };

    Filter.prototype.intersection = function(arrays) {
      return arrays.shift().reduce((function(res, v) {
        if (res.indexOf(v) === -1 && arrays.every((function(a) {
          return a.indexOf(v) !== -1;
        }))) {
          res.push(v);
        }
        return res;
      }), []);
    };

    Filter.prototype.debounce = function(func, threshold, execAsap) {
      var timeout;
      timeout = null;
      return function() {
        var args, delayed, obj;
        args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
        obj = this;
        delayed = function() {
          if (!execAsap) {
            func.apply(obj, args);
          }
          return timeout = null;
        };
        if (timeout) {
          clearTimeout(timeout);
        } else if (execAsap) {
          func.apply(obj, args);
        }
        return timeout = setTimeout(delayed, threshold || 100);
      };
    };

    Filter.prototype.throttle = function(fn, threshold, scope) {
      var deferTimer, last;
      threshold || (threshold = 250);
      last = void 0;
      deferTimer = void 0;
      return function() {
        var args, context, now;
        context = scope || this;
        now = +(new Date);
        args = arguments;
        if (last && now < last + threshold) {
          clearTimeout(deferTimer);
          deferTimer = setTimeout((function() {
            last = now;
            fn.apply(context, args);
          }), threshold);
        } else {
          last = now;
          fn.apply(context, args);
        }
      };
    };

    return Filter;

  })(Annotator.Plugin);

}).call(this);
