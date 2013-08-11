'use strict'

var index = new function(){
    var that = this;
    var j_win;
    var j_menutag;
    var j_menu;
    var j_paneltag;
    var j_panel;
    var j_header;
    var j_alertbox;

    function active_header(){
        j_header.addClass('active');
    }
    function inactive_header(){
        if(j_win.scrollTop() > 8 && !j_header.hasClass('force')){
            j_header.removeClass('active');
        }
    }
    function active_menutag(){
        j_menutag.addClass('active');
    };
    function inactive_menutag(){
        if(j_win.scrollTop() > 8 && !j_menutag.hasClass('force') && !j_menu.hasClass('active')){
            j_menutag.removeClass('active');
        }
    };
    function active_paneltag(){
        j_paneltag.addClass('active');
    };
    function inactive_paneltag(){
        if(j_win.scrollTop() > 8 && !j_paneltag.hasClass('force') && !j_panel.hasClass('active')){
            j_paneltag.removeClass('active');
        }
    };
    function active_menu(){
        j_menu.addClass('active');
        active_menutag();
    };
    function inactive_menu(){
        j_menu.removeClass('active');
        inactive_menutag();
    };
    function active_panel(){
        j_panel.addClass('active');
        active_paneltag();
    };
    function inactive_panel(){
        j_panel.removeClass('active');
        inactive_paneltag();
    };
    
    that.ready = function(){
        j_win = $(window);
        j_menutag = $('#index_menutag');
        j_menu = $('#index_menu');
        j_paneltag = $('#index_paneltag');
        j_panel = $('#index_panel');
        j_header = $('#index_header');
        j_alertbox = $('#index_alert');

        function _change(){
            if(j_win.scrollTop() <= 8){
                active_header();
                active_menutag();
                active_paneltag();
            }else{
                inactive_header();
                inactive_menutag();
                inactive_paneltag();
            }
        }
        
        j_win.on('scroll',function(e){
            _change(); 
        });
        j_win.on('mouseover',function(e){
            var j_e;
            
            j_e = $(e.target);
            if(!j_e.is(j_menutag) && j_e.parents('#index_menutag').length == 0 &&
               !j_e.is(j_menu) && j_e.parents('#index_menu').length == 0){

                inactive_menu();
            }
        });
        j_win.on('click',function(e){
            var j_e;
            
            j_e = $(e.target);
            if(!j_e.is(j_paneltag) && j_e.parents('#index_paneltag').length == 0 &&
               !j_e.is(j_panel) && j_e.parents('#index_panel').length == 0){

                inactive_panel();
            }
        });

        j_menutag.find('div.menu').on('mouseover',function(e){
            active_menu();
        });
        j_paneltag.find('div.notice').on('click',function(e){
            if(j_panel.hasClass('active')){
                inactive_panel();
            }else{
                active_panel();
            }   
        });
        j_panel.find('div.notice').on('click',function(e){
            if(j_panel.hasClass('active')){
                inactive_panel();
            }
        });

        user.datachg_callback.add(function(type){
            var j_a;

            j_a = j_header.find('li.nickname > a');
            j_a.text(user.nickname);
            j_a.attr('href','/toj/user:' + user.uid + '/main/');
            console.log(type);

            if(type == 'login'){
                j_header.find('li.login').hide();
                j_header.find('li.register').hide();
                j_header.find('li.nickname').show();
                j_header.find('li.logout').show();
                
                j_a = j_menu.find('div.menu a.profile');
                j_a.attr('href','/toj/user:' + user.uid + '/main/'); 
                j_a.show();
                j_menu.find('div.menu a.mail').show();
                j_menu.find('div.menu a.manage').show();
            }   
        });

        _change(); 
    };
    that.set_title = function(title){
        j_header.find('p.title').text(title); 
    };
    that.set_menu = function(tag){
        j_menutag.find('div.menu').text(tag); 
    };
    that.add_tabnav = function(text,link){
        var j_li = $('<li><a></a></li>');
        var j_a = j_li.find('a');
        
        j_a.text(text);
        j_a.attr('href',link);

        j_header.find('div.container ul.navbar-nav').append(j_li);        

        j_li.active = function(){
            j_header.find('div.container ul.navbar-nav > li.active').removeClass('active');
            j_li.addClass('active');
        };

        return j_li;
    };
    that.clear_tabnav = function(){
        j_header.find('div.container ul.navbar-nav').empty();        
    };
    that.add_alert = function(type,title,content,autofade){
        var j_alert;

        j_alert = $('<div class="alert fade in"><button type="button" class="close" data-dismiss="alert">&times;</button><strong></strong>&nbsp<span></span></div>');

        j_alert.addClass(type);
        j_alert.find('strong').text(title);
        j_alert.find('span').text(content);

        if(autofade != false){
            setTimeout(function(){
                j_alert.alert('close');
            },5000);
        }

        j_alertbox.prepend(j_alert);
    };
};
