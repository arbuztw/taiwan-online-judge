var notice = {
    j_ajax:null,
    enid:null,

    init:function(){
	$('body').on('click',function(e){
	    var j_notice;

	    if(e.target == null || ($(e.target).parents('a.item').length == 0 && $(e.target).parents('#notice_list').length > 0)){
		return;
	    }

	    j_notice = $('#index_head_notice');
	    if(e.target.id == 'index_head_notice' && !j_notice.hasClass('notice_s')){
		j_notice.addClass('notice_s');
		$('#notice_list_box').stop().animate({width:256},'slow','easeOutExpo');
		$('#notice_list').css('opacity','1').stop().animate({right:0},'slow','easeOutExpo');
		$('#notice_list a.item').stop().animate({left:0},'slow','easeOutQuart');
	    }else{
		j_notice.removeClass('notice_s');
		$('#notice_list').stop().animate({opacity:0},'fast','easeOutQuad',
		    function(){
			$('#notice_list_box').css('width','0px');
			$('#notice_list').css('right','-256px');
			$('#notice_list a.item').css('left','50%');
		    }
		);
	    }
	});
	$('#index_head_notice').on('click',function(e){
	    var j_list;

	    j_list = $('#notice_list');
	    if(j_list.css('opacity') == 0){
		j_list.empty();
		notice.enid = null;
		notice.updatenew(); 
	    }
	}).on('mousedown',function(e){
	    return false;
	});

	notice.refresh();
    },
    listnew:function(noticeo){
	j_item = $('<li class="item"><a class="item"><div class="head"></div><div class="content"></div></a></li>')
	j_a = j_item.find('a.item');
	j_head = j_item.find('div.head');
	j_content = j_item.find('div.content');

	switch(noticeo.type){
	    case 'result':
		j_a.attr('href','/toj/stat/allsub/' + noticeo.subid + '/');
		j_head.text('Submit ' + noticeo.subid);
		j_content.html('ProID ' + noticeo.proid + ' 結果: ' + RESULTMAP[noticeo.result] + '<br>' + noticeo.runtime+ 'ms / ' + noticeo.memory + 'KB');
		break;
	}

	return j_item;
    },
    updatenew:function(){
	var j_list;

	if(notice.j_ajax != null){
	    notice.j_ajax.abort();
	}

	j_list = $('#notice_list');
	notice.j_ajax = $.post('/toj/php/notice.php',{'action':'get','data':JSON.stringify({'nid':0,'count':10})},
	    function(res){
		var i;

		var reto;
		var noticeo;
		var j_item;
		var j_a;

		if(res[0] != 'E'){
		    reto = JSON.parse(res);
		    for(i = 0;i < reto.length;i++){
			noticeo = JSON.parse(reto[i].txt);
			j_item = notice.listnew(noticeo);
			j_list.prepend(j_item);
			j_a = j_item.find('a.item');
			j_a.addClass('item_h');
			j_a.stop().animate({left:0},'slow','easeOutQuart');
		    }

		    if(notice.enid == null){
			if(reto.length == 0){
			    notice.enid = 2147483647;
			}else{
			    notice.enid = reto[0].nid;
			}
			notice.updateprev(); 
		    }
		}

		notice.j_ajax = null;
	    }
	);
    },
    updateprev:function(){
	var j_list;

	j_list = $('#notice_list');
	$.post('/toj/php/notice.php',{'action':'get','data':JSON.stringify({'nid':notice.enid,'count':10})},
	    function(res){
		var i;

		var reto;
		var noticeo;
		var j_item;

		if(res[0] != 'E'){
		    reto = JSON.parse(res);
		    for(i = reto.length - 1;i >= 0;i--){
			noticeo = JSON.parse(reto[i].txt);
			j_item = notice.listnew(noticeo);
			j_list.append(j_item);
			j_item.find('a.item').stop().animate({left:0},'slow','easeOutQuart');
		    }

		    notice.enid = 0;
		}
	    }
	);
    },
    refresh:function(){
	$.post('/toj/php/notice.php',{'action':'count','data':JSON.stringify({})},
	    function(res){
		var count;
		var j_notice;

		if(res[0] != 'E'){
		    count = JSON.parse(res);
		    j_notice = $('#index_head_notice');
		    if(count == 0){
			j_notice.removeClass('notice_h');
			j_notice.text('[' + count + ']');
		    }else{
			if($('#notice_list').css('opacity') == 1){
			    notice.updatenew();
			}else{
			    j_notice.addClass('notice_h');
			    j_notice.text('[' + count + ']');
			}
		    }
		    
		    setTimeout(notice.refresh,1000);
		}
	    }
	);
    }
};
